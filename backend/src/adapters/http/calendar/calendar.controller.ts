import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { GetCalendarViewUseCase } from '@/use-cases/get-calendar-view/get-calendar-view.use-case';
import type { UpsertOverrideUseCase }  from '@/use-cases/upsert-override/upsert-override.use-case';
import type { DeleteOverrideUseCase }  from '@/use-cases/delete-override/delete-override.use-case';
import type { IMasterRepository }      from '@/domain/ports/master.repo.port';
import { verifyInitData }              from '@/shared/lib/telegram-auth';
import { env }                         from '@/shared/config/env';

const dateSchema  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuidSchema  = z.string().uuid();

const calendarQuerySchema = z.object({
  from: dateSchema,
  to:   dateSchema,
});

const blockBodySchema = z.object({
  date:   dateSchema,
  reason: z.string().max(200).nullable().optional(),
});

export interface CalendarDeps {
  getCalendarView: GetCalendarViewUseCase;
  upsertOverride:  UpsertOverrideUseCase;
  deleteOverride:  DeleteOverrideUseCase;
  mastersRepo:     IMasterRepository;
}

async function resolveMaster(req: FastifyRequest, mastersRepo: IMasterRepository) {
  const initData = req.headers['x-init-data'];
  if (!initData || typeof initData !== 'string') return null;
  const user = verifyInitData(initData, env.BOT_TOKEN);
  if (!user) return null;
  return mastersRepo.findByTelegramId(user.id);
}

export function makeCalendarRoutes(deps: CalendarDeps) {
  return async function calendarRoutes(app: FastifyInstance) {

    // GET /api/v1/me/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
    app.get('/', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      const q = calendarQuerySchema.safeParse(req.query);
      if (!q.success) return reply.status(400).send({ error: q.error.flatten() });

      const days = await deps.getCalendarView.execute(master.id, q.data.from, q.data.to);
      return { days };
    });

    // POST /api/v1/me/calendar/block — block a day
    app.post('/block', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      const result = blockBodySchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ error: result.error.flatten() });

      const override = await deps.upsertOverride.execute(master.id, {
        override_date: result.data.date,
        is_working:    false,
        start_time:    null,
        end_time:      null,
        reason:        result.data.reason ?? null,
      });
      return reply.status(201).send({ override });
    });

    // DELETE /api/v1/me/calendar/block/:id — unblock a day
    app.delete<{ Params: { id: string } }>('/block/:id', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      if (!uuidSchema.safeParse(req.params.id).success) {
        return reply.status(400).send({ error: 'Invalid id' });
      }

      await deps.deleteOverride.execute(req.params.id, master.id);
      return reply.status(204).send();
    });
  };
}
