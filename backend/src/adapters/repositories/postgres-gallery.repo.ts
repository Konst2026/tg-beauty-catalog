import type { Pool }              from 'pg';
import type { Gallery, CreateGalleryInput } from '@/domain/gallery/gallery.entity';
import type { IGalleryRepository } from '@/domain/ports/gallery.repo.port';

export class PostgresGalleryRepo implements IGalleryRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Gallery | null> {
    const { rows } = await this.pool.query<Gallery>(
      `SELECT * FROM gallery WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByMasterId(masterId: string): Promise<Gallery[]> {
    const { rows } = await this.pool.query<Gallery>(
      `SELECT * FROM gallery WHERE master_id = $1 ORDER BY sort_order, created_at`,
      [masterId],
    );
    return rows;
  }

  async create(input: CreateGalleryInput): Promise<Gallery> {
    const { rows } = await this.pool.query<Gallery>(
      `INSERT INTO gallery (master_id, photo_url, caption)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.master_id, input.photo_url, input.caption ?? null],
    );
    return rows[0];
  }

  async delete(id: string, masterId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM gallery WHERE id = $1 AND master_id = $2`,
      [id, masterId],
    );
    return (rowCount ?? 0) > 0;
  }
}
