import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { DomainError } from '@/shared/errors/domain-error';
import { env } from '@/shared/config/env';

import { pool }                  from '@/infrastructure/postgres/pool';
import { PostgresMastersRepo }   from '@/adapters/repositories/postgres-masters.repo';
import { PostgresBookingsRepo }  from '@/adapters/repositories/postgres-bookings.repo';
import { GetMastersUseCase }     from '@/use-cases/get-masters/get-masters.use-case';
import { GetMasterByIdUseCase }  from '@/use-cases/get-master-by-id/get-master-by-id.use-case';
import { CreateBookingUseCase }  from '@/use-cases/create-booking/create-booking.use-case';
import { GetMyBookingsUseCase }  from '@/use-cases/get-my-bookings/get-my-bookings.use-case';
import { CancelBookingUseCase }  from '@/use-cases/cancel-booking/cancel-booking.use-case';
import { makeCatalogRoutes }     from '@/adapters/http/catalog/catalog.controller';
import { makeBookingsRoutes }    from '@/adapters/http/bookings/bookings.controller';

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
  const mastersRepo  = new PostgresMastersRepo(pool);
  const bookingsRepo = new PostgresBookingsRepo(pool);

  const getMasters    = new GetMastersUseCase(mastersRepo);
  const getMasterById = new GetMasterByIdUseCase(mastersRepo);
  const createBooking = new CreateBookingUseCase(bookingsRepo, mastersRepo);
  const getMyBookings = new GetMyBookingsUseCase(bookingsRepo);
  const cancelBooking = new CancelBookingUseCase(bookingsRepo);

  // ─── Routes ────────────────────────────────────────────────
  app.register(makeCatalogRoutes({ getMasters, getMasterById }), {
    prefix: '/api/v1/catalog',
  });

  app.register(makeBookingsRoutes({ createBooking, getMyBookings, cancelBooking }), {
    prefix: '/api/v1/bookings',
  });

  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok', ts: new Date().toISOString(),
  }));

  // ─── Error handler ─────────────────────────────────────────
  const domainStatusMap: Record<string, number> = {
    MASTER_NOT_FOUND:    404,
    MASTER_UNAVAILABLE:  422,
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
