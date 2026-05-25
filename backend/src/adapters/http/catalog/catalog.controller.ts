import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { GetMastersUseCase } from '@/use-cases/get-masters/get-masters.use-case';
import type { GetMasterByIdUseCase } from '@/use-cases/get-master-by-id/get-master-by-id.use-case';

const uuidSchema = z.string().uuid();

const filterSchema = z.object({
  category_id:    z.string().uuid().optional(),
  city:           z.string().max(100).optional(),
  available_today: z.enum(['true', 'false']).optional()
    .transform(v => v === undefined ? undefined : v === 'true'),
});

interface Deps {
  getMasters:    GetMastersUseCase;
  getMasterById: GetMasterByIdUseCase;
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
  };
}
