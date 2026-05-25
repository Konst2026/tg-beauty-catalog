import type { FastifyInstance, FastifyRequest } from 'fastify';
import multipart                               from '@fastify/multipart';
import { z }                                   from 'zod';
import type { UploadGalleryPhotoUseCase }  from '@/use-cases/upload-gallery-photo/upload-gallery-photo.use-case';
import type { DeleteGalleryPhotoUseCase }  from '@/use-cases/delete-gallery-photo/delete-gallery-photo.use-case';
import type { IGalleryRepository }         from '@/domain/ports/gallery.repo.port';
import type { IMasterRepository }          from '@/domain/ports/master.repo.port';
import { verifyInitData }                  from '@/shared/lib/telegram-auth';
import { env }                             from '@/shared/config/env';

const uuidSchema = z.string().uuid();

export interface GalleryDeps {
  uploadGalleryPhoto: UploadGalleryPhotoUseCase;
  deleteGalleryPhoto: DeleteGalleryPhotoUseCase;
  galleryRepo:        IGalleryRepository;
  mastersRepo:        IMasterRepository;
}

async function resolveMaster(req: FastifyRequest, mastersRepo: IMasterRepository) {
  const initData = req.headers['x-init-data'];
  if (!initData || typeof initData !== 'string') return null;
  const user = verifyInitData(initData, env.BOT_TOKEN);
  if (!user) return null;
  return mastersRepo.findByTelegramId(user.id);
}

export function makeGalleryRoutes(deps: GalleryDeps) {
  return async function galleryRoutes(app: FastifyInstance) {
    app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

    // GET /api/v1/me/gallery
    app.get('/', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });
      const photos = await deps.galleryRepo.findByMasterId(master.id);
      return { photos };
    });

    // POST /api/v1/me/gallery — upload photo (multipart/form-data)
    app.post('/', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      const data = await req.file();
      if (!data) return reply.status(400).send({ error: 'No file provided' });

      const buffer  = await data.toBuffer();
      const caption = (data.fields['caption'] as { value?: string } | undefined)?.value;

      const photo = await deps.uploadGalleryPhoto.execute(master.id, buffer, data.mimetype, caption);
      return reply.status(201).send({ photo });
    });

    // DELETE /api/v1/me/gallery/:id
    app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
      const master = await resolveMaster(req, deps.mastersRepo);
      if (!master) return reply.status(401).send({ error: 'Unauthorized' });

      if (!uuidSchema.safeParse(req.params.id).success) {
        return reply.status(400).send({ error: 'Invalid id' });
      }

      await deps.deleteGalleryPhoto.execute(req.params.id, master.id);
      return reply.status(204).send();
    });
  };
}
