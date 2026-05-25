import { randomUUID }            from 'crypto';
import type { Gallery }           from '@/domain/gallery/gallery.entity';
import type { IGalleryRepository } from '@/domain/ports/gallery.repo.port';
import type { IStoragePort }      from '@/domain/ports/storage.port';
import { DomainError }            from '@/shared/errors/domain-error';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES    = 5 * 1024 * 1024; // 5 MB

export class UploadGalleryPhotoUseCase {
  constructor(
    private readonly galleryRepo: IGalleryRepository,
    private readonly storage:     IStoragePort,
  ) {}

  async execute(
    masterId: string,
    buffer:   Buffer,
    mimeType: string,
    caption?: string | null,
  ): Promise<Gallery> {
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new DomainError('Only JPEG, PNG and WebP images are allowed', 'INVALID_FILE_TYPE');
    }
    if (buffer.byteLength > MAX_BYTES) {
      throw new DomainError('File size must not exceed 5 MB', 'FILE_TOO_LARGE');
    }

    const ext      = mimeType.split('/')[1];
    const path     = `gallery/${masterId}/${randomUUID()}.${ext}`;
    const photoUrl = await this.storage.upload(path, buffer, mimeType);

    return this.galleryRepo.create({ master_id: masterId, photo_url: photoUrl, caption });
  }
}
