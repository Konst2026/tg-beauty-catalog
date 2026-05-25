import type { Gallery, CreateGalleryInput } from '@/domain/gallery/gallery.entity';

export interface IGalleryRepository {
  findById(id: string): Promise<Gallery | null>;
  findByMasterId(masterId: string): Promise<Gallery[]>;
  create(input: CreateGalleryInput): Promise<Gallery>;
  delete(id: string, masterId: string): Promise<boolean>;
}
