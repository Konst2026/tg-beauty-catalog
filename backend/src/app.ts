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
import { makeCatalogRoutes }      from '@/adapters/http/catalog/catalog.controller';
import { makeBookingsRoutes }     from '@/adapters/http/bookings/bookings.controller';
import { makeServicesRoutes }     from '@/adapters/http/services/services.controller';
import { makeScheduleRoutes }     from '@/adapters/http/schedule/schedule.controller';
import { makeBotRoutes }          from '@/adapters/http/bot/bot.controller';
import { makeWebhookRoutes }      from '@/adapters/http/webhook/webhook.controller';
import { GrammyBotApiAdapter }    from '@/infrastructure/telegram/grammy-bot-api.adapter';
import { BotManager }             from '@/infrastructure/telegram/bot-manager';
import { TokenCrypto }            from '@/shared/lib/token-crypto';

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

  const tokenCrypto   = new TokenCrypto(env.TOKEN_ENCRYPTION_KEY);
  const botApi        = new GrammyBotApiAdapter();
  const botManager    = new BotManager(mastersRepo, tokenCrypto, env.MINI_APP_URL);

  const getMasters         = new GetMastersUseCase(mastersRepo);
  const getMasterById      = new GetMasterByIdUseCase(mastersRepo);
  const createBooking      = new CreateBookingUseCase(bookingsRepo, mastersRepo);
  const getMyBookings      = new GetMyBookingsUseCase(bookingsRepo);
  const cancelBooking      = new CancelBookingUseCase(bookingsRepo);
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

  app.register(makeBotRoutes({ connectBot, disconnectBot, mastersRepo }), {
    prefix: '/api/v1/me/bot',
  });

  app.register(makeWebhookRoutes({ mastersRepo, botManager }), {
    prefix: '/webhook',
  });

  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok', ts: new Date().toISOString(),
  }));

  // ─── Error handler ─────────────────────────────────────────
  const domainStatusMap: Record<string, number> = {
    MASTER_NOT_FOUND:       404,
    MASTER_UNAVAILABLE:     422,
    SERVICE_NOT_FOUND:       404,
    SERVICE_LIMIT_REACHED:   422,
    INVALID_SCHEDULE_TIME:   422,
    OVERRIDE_NOT_FOUND:      404,
  };

  app.setErrorHandler(async (err: FastifyError | Error, _req, reply) => {
    app.log.error(err);

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
