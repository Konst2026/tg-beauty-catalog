import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z }                                    from 'zod';
import type { UpdateThemeUseCase }  from '@/use-cases/update-theme/update-theme.use-case';
import type { IMasterRepository }   from '@/domain/ports/master.repo.port';
import { verifyInitData }           from '@/shared/lib/telegram-auth';
import { env }                      from '@/shared/config/env';

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const updateThemeSchema = z.object({
  primary_color: hexColorSchema.optional(),
  logo_url:      z.string().url().nullable().optional(),
  name:          z.string().max(100).nullable().optional(),
});

export interface ThemeDeps {
  updateTheme: UpdateThemeUseCase;
  mastersRepo: IMasterRepository;
}

async function resolveMaster(req: FastifyRequest, mastersRepo: IMasterRepository) {
  const initData = req.headers['x-init-data'];
  if (!initData || typeof initData !== 'string') return null;
  const user = verifyInitData(initData, env.BOT_TOKEN);
  if (!user) return null;
  return mastersRepo.findByTelegramId(user.id);
}

export function makeThemeRoutes(deps: ThemeDeps) {
  return async function themeRoutes(app: FastifyInstance) {

    // GET /api/v1/me/theme
    app.get('/', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });
      return {
        theme: {
          primary_color: master.theme_primary_color,
          logo_url:      master.theme_logo_url,
          name:          master.theme_name,
        },
      };
    });

    // PUT /api/v1/me/theme
    app.put('/', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      const result = updateThemeSchema.safeParse(req.body);
      if (!result.success) return reply.status(400).send({ error: result.error.flatten() });

      await deps.updateTheme.execute(master.id, result.data);
      return reply.status(204).send();
    });
  };
}
