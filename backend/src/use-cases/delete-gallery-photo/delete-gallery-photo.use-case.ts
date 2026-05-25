import type { IGalleryRepository } from '@/domain/ports/gallery.repo.port';
import type { IStoragePort }       from '@/domain/ports/storage.port';
import { DomainError }             from '@/shared/errors/domain-error';

const BUCKET_MARKER = '/storage/v1/object/public/beautybook-media/';

function extractStoragePath(publicUrl: string): string | null {
  const idx = publicUrl.indexOf(BUCKET_MARKER);
  if (idx === -1) return null;
  return publicUrl.slice(idx + BUCKET_MARKER.length);
}

export class DeleteGalleryPhotoUseCase {
  constructor(
    private readonly galleryRepo: IGalleryRepository,
    private readonly storage:     IStoragePort,
  ) {}

  async execute(id: string, masterId: string): Promise<void> {
    const photo = await this.galleryRepo.findById(id);
    if (!photo || photo.master_id !== masterId) {
      throw new DomainError('Photo not found', 'PHOTO_NOT_FOUND');
    }

    const storagePath = extractStoragePath(photo.photo_url);
    if (storagePath) {
      // Best-effort: storage delete failure shouldn't block DB cleanup
      await this.storage.delete(storagePath).catch(() => undefined);
    }

    await this.galleryRepo.delete(id, masterId);
  }
}
