import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { DomainError } from '@/shared/errors/domain-error';
import { env } from '@/shared/config/env';

import { pool }                   from '@/infrastructure/postgres/pool';
import { PostgresMastersRepo }    from '@/adapters/repositories/postgres-masters.repo';
import { PostgresBookingsRepo }   from '@/adapters/repositories/postgres-bookings.repo';
import { PostgresServicesRepo }   from '@/adapters/repositories/postgres-services.repo';
import { PostgresSchedulesRepo }  from '@/adapters/repositories/postgres-schedules.repo';
import { GetMastersUseCase }      from '@/use-cases/get-masters/get-masters.use-case';
import { GetMasterByIdUseCase }   from '@/use-cases/get-master-by-id/get-master-by-id.use-case';
import { CreateBookingUseCase }   from '@/use-cases/create-booking/create-booking.use-case';
import { GetMyBookingsUseCase }   from '@/use-cases/get-my-bookings/get-my-bookings.use-case';
import { CancelBookingUseCase }   from '@/use-cases/cancel-booking/cancel-booking.use-case';
import { GetServicesUseCase }     from '@/use-cases/get-services/get-services.use-case';
import { CreateServiceUseCase }   from '@/use-cases/create-service/create-service.use-case';
import { UpdateServiceUseCase }   from '@/use-cases/update-service/update-service.use-case';
import { DeleteServiceUseCase }   from '@/use-cases/delete-service/delete-service.use-case';
import { GetScheduleUseCase }     from '@/use-cases/get-schedule/get-schedule.use-case';
import { UpsertScheduleUseCase }  from '@/use-cases/upsert-schedule/upsert-schedule.use-case';
import { GetOverridesUseCase }    from '@/use-cases/get-overrides/get-overrides.use-case';
import { UpsertOverrideUseCase }  from '@/use-cases/upsert-override/upsert-override.use-case';
import { DeleteOverrideUseCase }  from '@/use-cases/delete-override/delete-override.use-case';
import { GetAvailableSlotsUseCase } from '@/use-cases/get-available-slots/get-available-slots.use-case';
import { ConnectBotUseCase }      from '@/use-cases/connect-bot/connect-bot.use-case';
import { DisconnectBotUseCase }   from '@/use-cases/disconnect-bot/disconnect-bot.use-case';
import { ExpireTrialsUseCase }    from '@/use-cases/expire-trials/expire-trials.use-case';
import { CleanupPendingBookingsUseCase } from '@/use-cases/cleanup-pending-bookings/cleanup-pending-bookings.use-case';
import { GetSubscriptionUseCase }    from '@/use-cases/get-subscription/get-subscription.use-case';
import { GetCalendarViewUseCase }    from '@/use-cases/get-calendar-view/get-calendar-view.use-case';
import { UploadGalleryPhotoUseCase } from '@/use-cases/upload-gallery-photo/upload-gallery-photo.use-case';
import { DeleteGalleryPhotoUseCase } from '@/use-cases/delete-gallery-photo/delete-gallery-photo.use-case';
import { UpdateThemeUseCase }        from '@/use-cases/update-theme/update-theme.use-case';
import { makeCatalogRoutes }         from '@/adapters/http/catalog/catalog.controller';
import { makeBookingsRoutes }        from '@/adapters/http/bookings/bookings.controller';
import { makeServicesRoutes }        from '@/adapters/http/services/services.controller';
import { makeScheduleRoutes }        from '@/adapters/http/schedule/schedule.controller';
import { makeCalendarRoutes }        from '@/adapters/http/calendar/calendar.controller';
import { makeGalleryRoutes }         from '@/adapters/http/gallery/gallery.controller';
import { makeThemeRoutes }           from '@/adapters/http/theme/theme.controller';
import { makeBotRoutes }             from '@/adapters/http/bot/bot.controller';
import { makeWebhookRoutes }         from '@/adapters/http/webhook/webhook.controller';
import { makeSubscriptionRoutes }    from '@/adapters/http/subscription/subscription.controller';
import { makeCheckPlan }             from '@/adapters/http/middleware/check-plan.middleware';
import { GrammyBotApiAdapter }        from '@/infrastructure/telegram/grammy-bot-api.adapter';
import { BotManager }                 from '@/infrastructure/telegram/bot-manager';
import { TokenCrypto }                from '@/shared/lib/token-crypto';
import { InProcessEventBus }          from '@/shared/lib/event-bus';
import { PostgresGalleryRepo }        from '@/adapters/repositories/postgres-gallery.repo';
import { SupabaseStorageAdapter }     from '@/infrastructure/storage/supabase-storage.adapter';
import { notificationQueue }      from '@/infrastructure/queue/notification.queue';
import { createNotificationWorker } from '@/infrastructure/queue/notification.worker';
import { cronQueue, scheduleCronJobs } from '@/infrastructure/queue/cron.queue';
import { createCronWorker }       from '@/infrastructure/queue/cron.worker';
import { TelegramNotificationAdapter } from '@/infrastructure/telegram/notification-adapter';
import { registerNotificationEventHandlers } from '@/infrastructure/event-handlers/notification.event-handler';
import { registerSubscriptionEventHandlers } from '@/infrastructure/event-handlers/subscription.event-handler';
import { PaymentRequiredError }   from '@/shared/errors/payment-required-error';

export function buildApp() {
  const app = Fastify({ logger: true });

  const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : true;
  app.register(cors, { origin: allowedOrigins });
  app.register(rateLimit, {
    global:     true,
    max:        100,
    timeWindow: '1 minute',
  });

  // ─── Composition Root ──────────────────────────────────────
  const mastersRepo   = new PostgresMastersRepo(pool);
  const bookingsRepo  = new PostgresBookingsRepo(pool);
  const servicesRepo  = new PostgresServicesRepo(pool);
  const schedulesRepo = new PostgresSchedulesRepo(pool);
  const galleryRepo   = new PostgresGalleryRepo(pool);
  const storage       = new SupabaseStorageAdapter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const tokenCrypto   = new TokenCrypto(env.TOKEN_ENCRYPTION_KEY);
  const botApi        = new GrammyBotApiAdapter();
  const botManager    = new BotManager(mastersRepo, tokenCrypto, env.MINI_APP_URL);
  const eventBus      = new InProcessEventBus();

  const notificationAdapter = new TelegramNotificationAdapter(botManager);
  const notificationWorker  = createNotificationWorker(notificationAdapter);
  registerNotificationEventHandlers(eventBus, notificationQueue);
  registerSubscriptionEventHandlers(eventBus, notificationAdapter);

  const expireTrials           = new ExpireTrialsUseCase(mastersRepo, eventBus);
  const cleanupPendingBookings = new CleanupPendingBookingsUseCase(bookingsRepo);
  const getSubscription        = new GetSubscriptionUseCase(mastersRepo);

  const cronWorker = createCronWorker({ expireTrials, cleanupPendingBookings });
  scheduleCronJobs().catch(err => app.log.error({ err }, 'Failed to schedule cron jobs'));

  app.addHook('onClose', async () => {
    await notificationWorker.close();
    await notificationQueue.close();
    await cronWorker.close();
    await cronQueue.close();
  });

  const getMasters         = new GetMastersUseCase(mastersRepo);
  const getMasterById      = new GetMasterByIdUseCase(mastersRepo);
  const createBooking      = new CreateBookingUseCase(bookingsRepo, mastersRepo, eventBus);
  const getMyBookings      = new GetMyBookingsUseCase(bookingsRepo);
  const cancelBooking      = new CancelBookingUseCase(bookingsRepo, eventBus);
  const getServices        = new GetServicesUseCase(servicesRepo);
  const createService      = new CreateServiceUseCase(servicesRepo);
  const updateService      = new UpdateServiceUseCase(servicesRepo);
  const deleteService      = new DeleteServiceUseCase(servicesRepo);
  const getSchedule        = new GetScheduleUseCase(schedulesRepo);
  const upsertSchedule     = new UpsertScheduleUseCase(schedulesRepo);
  const getOverrides       = new GetOverridesUseCase(schedulesRepo);
  const upsertOverride     = new UpsertOverrideUseCase(schedulesRepo);
  const deleteOverride     = new DeleteOverrideUseCase(schedulesRepo);
  const getAvailableSlots  = new GetAvailableSlotsUseCase(schedulesRepo, servicesRepo);
  const connectBot         = new ConnectBotUseCase(mastersRepo, botApi, tokenCrypto, env.PLATFORM_URL);
  const disconnectBot      = new DisconnectBotUseCase(mastersRepo, botApi, tokenCrypto, botManager);
  const getCalendarView    = new GetCalendarViewUseCase(schedulesRepo);
  const uploadGalleryPhoto = new UploadGalleryPhotoUseCase(galleryRepo, storage);
  const deleteGalleryPhoto = new DeleteGalleryPhotoUseCase(galleryRepo, storage);
  const updateTheme        = new UpdateThemeUseCase(mastersRepo);

  // ─── Routes ────────────────────────────────────────────────
  app.register(makeCatalogRoutes({ getMasters, getMasterById, getAvailableSlots }), {
    prefix: '/api/v1/catalog',
  });

  app.register(makeBookingsRoutes({ createBooking, getMyBookings, cancelBooking }), {
    prefix: '/api/v1/bookings',
  });

  app.register(makeServicesRoutes({ getServices, createService, updateService, deleteService, mastersRepo }), {
    prefix: '/api/v1/me/services',
  });

  app.register(makeScheduleRoutes({ getSchedule, upsertSchedule, getOverrides, upsertOverride, deleteOverride, mastersRepo }), {
    prefix: '/api/v1/me/schedule',
  });

  app.register(makeCalendarRoutes({ getCalendarView, upsertOverride, deleteOverride, mastersRepo }), {
    prefix: '/api/v1/me/calendar',
  });

  app.register(makeGalleryRoutes({ uploadGalleryPhoto, deleteGalleryPhoto, galleryRepo, mastersRepo }), {
    prefix: '/api/v1/me/gallery',
  });

  app.register(makeThemeRoutes({ updateTheme, mastersRepo }), {
    prefix: '/api/v1/me/theme',
  });

  app.register(makeBotRoutes({ connectBot, disconnectBot, mastersRepo }), {
    prefix: '/api/v1/me/bot',
  });

  app.register(makeSubscriptionRoutes({ getSubscription, mastersRepo }), {
    prefix: '/api/v1/me/subscription',
  });

  const checkPlan = makeCheckPlan(mastersRepo);

  // Guard mutation routes (POST/PUT/DELETE) when master plan is expired
  app.addHook('preHandler', async (req, reply) => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD') return;
    const url = req.url;
    if (
      url.startsWith('/api/v1/me/services') ||
      url.startsWith('/api/v1/me/schedule') ||
      url.startsWith('/api/v1/me/calendar') ||
      url.startsWith('/api/v1/me/gallery') ||
      url.startsWith('/api/v1/me/theme') ||
      url.startsWith('/api/v1/me/bot') ||
      url.startsWith('/api/v1/me/subscription')
    ) {
      await checkPlan(req, reply);
    }
  });

  app.register(makeWebhookRoutes({ mastersRepo, botManager }), {
    prefix: '/webhook',
  });

  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok', ts: new Date().toISOString(),
  }));

  // ─── Error handler ─────────────────────────────────────────
  const domainStatusMap: Record<string, number> = {
    MASTER_NOT_FOUND:             404,
    MASTER_UNAVAILABLE:           422,
    MASTER_SUBSCRIPTION_EXPIRED:  402,
    SERVICE_NOT_FOUND:            404,
    SERVICE_LIMIT_REACHED:        422,
    INVALID_SCHEDULE_TIME:        422,
    OVERRIDE_NOT_FOUND:           404,
    PHOTO_NOT_FOUND:              404,
    INVALID_FILE_TYPE:            422,
    FILE_TOO_LARGE:               413,
    STORAGE_NOT_CONFIGURED:       503,
  };

  app.setErrorHandler(async (err: FastifyError | Error, _req, reply) => {
    app.log.error(err);

    if (err instanceof PaymentRequiredError) {
      return reply.status(402).send({ error: err.message, code: err.code });
    }

    if (err instanceof DomainError) {
      const status = domainStatusMap[err.code] ?? 422;
      return reply.status(status).send({ error: err.message, code: err.code });
    }

    if ((err as { code?: string }).code === '23P01') {
      return reply.status(409).send({ error: 'Slot is already taken', code: 'SLOT_TAKEN' });
    }

    if ((err as FastifyError).validation) {
      return reply.status(400).send({ error: 'Validation error', details: (err as FastifyError).validation });
    }

    return reply.status(500).send({ error: 'Internal server error' });
  });

  return app;
}
