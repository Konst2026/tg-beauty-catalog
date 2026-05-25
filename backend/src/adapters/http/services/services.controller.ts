import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { GetServicesUseCase }    from '@/use-cases/get-services/get-services.use-case';
import type { CreateServiceUseCase }  from '@/use-cases/create-service/create-service.use-case';
import type { UpdateServiceUseCase }  from '@/use-cases/update-service/update-service.use-case';
import type { DeleteServiceUseCase }  from '@/use-cases/delete-service/delete-service.use-case';
import type { IMasterRepository }     from '@/domain/ports/master.repo.port';
import { verifyInitData }             from '@/shared/lib/telegram-auth';
import { env }                        from '@/shared/config/env';

const uuidSchema = z.string().uuid();

const createServiceSchema = z.object({
  name:         z.string().min(1).max(200),
  description:  z.string().max(1000).optional(),
  duration_min: z.number().int().positive().max(480),
  price:        z.number().positive(),
  sort_order:   z.number().int().min(0).optional(),
});

const updateServiceSchema = createServiceSchema.extend({
  is_active: z.boolean().optional(),
}).partial();

export interface ServicesDeps {
  getServices:   GetServicesUseCase;
  createService: CreateServiceUseCase;
  updateService: UpdateServiceUseCase;
  deleteService: DeleteServiceUseCase;
  mastersRepo:   IMasterRepository;
}

async function resolveMaster(req: FastifyRequest, mastersRepo: IMasterRepository) {
  const initData = req.headers['x-init-data'];
  if (!initData || typeof initData !== 'string') return null;
  const user = verifyInitData(initData, env.BOT_TOKEN);
  if (!user) return null;
  return mastersRepo.findByTelegramId(user.id);
}

export function makeServicesRoutes(deps: ServicesDeps) {
  return async function servicesRoutes(app: FastifyInstance) {

    app.get('/', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });
      const services = await deps.getServices.execute(master.id);
      return { services };
    });

    app.post('/', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      const result = createServiceSchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ error: result.error.flatten() });

      const service = await deps.createService.execute(master.id, result.data);
      return reply.status(201).send({ service });
    });

    app.put<{ Params: { id: string } }>('/:id', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      if (!uuidSchema.safeParse(req.params.id).success) {
        return reply.status(400).send({ error: 'Invalid service id' });
      }

      const result = updateServiceSchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ error: result.error.flatten() });

      const service = await deps.updateService.execute(req.params.id, master.id, result.data);
      return { service };
    });

    app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      if (!uuidSchema.safeParse(req.params.id).success) {
        return reply.status(400).send({ error: 'Invalid service id' });
      }

      await deps.deleteService.execute(req.params.id, master.id);
      return reply.status(204).send();
    });
  };
}
