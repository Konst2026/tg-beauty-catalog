import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { GetMastersUseCase }        from '@/use-cases/get-masters/get-masters.use-case';
import type { GetMasterByIdUseCase }     from '@/use-cases/get-master-by-id/get-master-by-id.use-case';
import type { GetAvailableSlotsUseCase } from '@/use-cases/get-available-slots/get-available-slots.use-case';

const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const filterSchema = z.object({
  category_id:     z.string().uuid().optional(),
  city:            z.string().max(100).optional(),
  available_today: z.enum(['true', 'false']).optional()
    .transform(v => v === undefined ? undefined : v === 'true'),
});

const slotsQuerySchema = z.object({
  date:       dateSchema,
  service_id: z.string().uuid(),
});

interface Deps {
  getMasters:         GetMastersUseCase;
  getMasterById:      GetMasterByIdUseCase;
  getAvailableSlots:  GetAvailableSlotsUseCase;
}

export function makeCatalogRoutes(deps: Deps) {
  return async function catalogRoutes(app: FastifyInstance) {
    app.get('/masters', async (req, reply) => {
      const result = filterSchema.safeParse(req.query);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.flatten() });
      }
      const masters = await deps.getMasters.execute(result.data);
      return { masters };
    });

    app.get<{ Params: { id: string } }>('/masters/:id', async (req, reply) => {
      if (!uuidSchema.safeParse(req.params.id).success) {
        return reply.status(400).send({ error: 'Invalid master id' });
      }
      const master = await deps.getMasterById.execute(req.params.id);
      if (!master) return reply.status(404).send({ error: 'Master not found' });
      return { master };
    });

    app.get<{ Params: { id: string } }>('/masters/:id/slots', async (req, reply) => {
      if (!uuidSchema.safeParse(req.params.id).success) {
        return reply.status(400).send({ error: 'Invalid master id' });
      }
      const q = slotsQuerySchema.safeParse(req.query);
      if (!q.success) return reply.status(400).send({ error: q.error.flatten() });

      const slots = await deps.getAvailableSlots.execute({
        masterId:  req.params.id,
        serviceId: q.data.service_id,
        date:      q.data.date,
      });
      return { slots };
    });
  };
}
