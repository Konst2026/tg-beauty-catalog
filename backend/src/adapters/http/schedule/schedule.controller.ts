import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { GetScheduleUseCase }    from '@/use-cases/get-schedule/get-schedule.use-case';
import type { UpsertScheduleUseCase } from '@/use-cases/upsert-schedule/upsert-schedule.use-case';
import type { GetOverridesUseCase }   from '@/use-cases/get-overrides/get-overrides.use-case';
import type { UpsertOverrideUseCase } from '@/use-cases/upsert-override/upsert-override.use-case';
import type { DeleteOverrideUseCase } from '@/use-cases/delete-override/delete-override.use-case';
import type { IMasterRepository }     from '@/domain/ports/master.repo.port';
import { verifyInitData }             from '@/shared/lib/telegram-auth';
import { env }                        from '@/shared/config/env';

const uuidSchema     = z.string().uuid();
const dateSchema     = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema     = z.string().regex(/^\d{2}:\d{2}$/);

const upsertDaySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_working:  z.boolean(),
  start_time:  timeSchema.nullable().optional(),
  end_time:    timeSchema.nullable().optional(),
});

const upsertOverrideSchema = z.object({
  override_date: dateSchema,
  is_working:    z.boolean(),
  start_time:    timeSchema.nullable().optional(),
  end_time:      timeSchema.nullable().optional(),
  reason:        z.string().max(200).nullable().optional(),
});

const getOverridesQuerySchema = z.object({
  from: dateSchema,
  to:   dateSchema,
});

export interface ScheduleDeps {
  getSchedule:    GetScheduleUseCase;
  upsertSchedule: UpsertScheduleUseCase;
  getOverrides:   GetOverridesUseCase;
  upsertOverride: UpsertOverrideUseCase;
  deleteOverride: DeleteOverrideUseCase;
  mastersRepo:    IMasterRepository;
}

async function resolveMaster(req: FastifyRequest, mastersRepo: IMasterRepository) {
  const initData = req.headers['x-init-data'];
  if (!initData || typeof initData !== 'string') return null;
  const user = verifyInitData(initData, env.BOT_TOKEN);
  if (!user) return null;
  return mastersRepo.findByTelegramId(user.id);
}

export function makeScheduleRoutes(deps: ScheduleDeps) {
  return async function scheduleRoutes(app: FastifyInstance) {

    // GET /api/v1/me/schedule — full weekly template
    app.get('/template', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });
      const schedule = await deps.getSchedule.execute(master.id);
      return { schedule };
    });

    // PUT /api/v1/me/schedule/template — upsert one day
    app.put('/template', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      const result = upsertDaySchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ error: result.error.flatten() });

      const day = await deps.upsertSchedule.execute(master.id, result.data);
      return { day };
    });

    // GET /api/v1/me/schedule/overrides?from=&to=
    app.get('/overrides', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      const q = getOverridesQuerySchema.safeParse(req.query);
      if (!q.success) return reply.status(400).send({ error: q.error.flatten() });

      const overrides = await deps.getOverrides.execute(master.id, q.data.from, q.data.to);
      return { overrides };
    });

    // PUT /api/v1/me/schedule/overrides — upsert override for a date
    app.put('/overrides', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      const result = upsertOverrideSchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ error: result.error.flatten() });

      const override = await deps.upsertOverride.execute(master.id, result.data);
      return { override };
    });

    // DELETE /api/v1/me/schedule/overrides/:id
    app.delete<{ Params: { id: string } }>('/overrides/:id', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      if (!uuidSchema.safeParse(req.params.id).success) {
        return reply.status(400).send({ error: 'Invalid override id' });
      }

      await deps.deleteOverride.execute(req.params.id, master.id);
      return reply.status(204).send();
    });
  };
}
