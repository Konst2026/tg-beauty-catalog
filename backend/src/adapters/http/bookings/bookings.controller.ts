import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { CreateBookingUseCase } from '@/use-cases/create-booking/create-booking.use-case';
import type { GetMyBookingsUseCase } from '@/use-cases/get-my-bookings/get-my-bookings.use-case';
import type { CancelBookingUseCase } from '@/use-cases/cancel-booking/cancel-booking.use-case';
import { verifyInitData, type TgUser } from '@/shared/lib/telegram-auth';

const uuidSchema = z.string().uuid();

const createBookingSchema = z.object({
  master_id:      z.string().uuid(),
  service_id:     z.string().uuid(),
  client_name:    z.string().min(1).max(200),
  start_time:     z.string().datetime(),
  end_time:       z.string().datetime(),
  price_snapshot: z.number().positive(),
  notes:          z.string().max(500).optional(),
});

export interface BookingsDeps {
  createBooking:  CreateBookingUseCase;
  getMyBookings:  GetMyBookingsUseCase;
  cancelBooking:  CancelBookingUseCase;
}

function getClient(req: FastifyRequest): TgUser | null {
  const initData = req.headers['x-init-data'];
  const token    = process.env.BOT_TOKEN;
  if (!initData || !token || typeof initData !== 'string') return null;
  return verifyInitData(initData, token);
}

export function makeBookingsRoutes(deps: BookingsDeps) {
  return async function bookingsRoutes(app: FastifyInstance) {

    app.post('/', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
      const client = getClient(req);
      if (!client) return reply.status(401).send({ error: 'Unauthorized' });

      const result = createBookingSchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ error: result.error.flatten() });

      const { start_time, end_time, ...rest } = result.data;

      const booking = await deps.createBooking.execute({
        ...rest,
        client_telegram_id: client.id,
        start_time: new Date(start_time),
        end_time:   new Date(end_time),
      });
      return reply.status(201).send({ booking });
    });

    app.get('/mine', async (req, reply) => {
      const client = getClient(req);
      if (!client) return reply.status(401).send({ error: 'Unauthorized' });

      const bookings = await deps.getMyBookings.execute(client.id);
      return { bookings };
    });

    app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
      const client = getClient(req);
      if (!client) return reply.status(401).send({ error: 'Unauthorized' });

      if (!uuidSchema.safeParse(req.params.id).success) {
        return reply.status(400).send({ error: 'Invalid booking id' });
      }

      const booking = await deps.cancelBooking.execute(req.params.id, client.id);
      if (!booking) return reply.status(404).send({ error: 'Booking not found or already cancelled' });
      return { booking };
    });
  };
}
