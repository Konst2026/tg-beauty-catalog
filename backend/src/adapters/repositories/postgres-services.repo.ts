import type { Pool } from 'pg';
import type { IServiceRepository } from '@/domain/ports/service.repo.port';
import type { Service, CreateServiceInput, UpdateServiceInput } from '@/domain/service/service.entity';

export class PostgresServicesRepo implements IServiceRepository {
  constructor(private readonly pool: Pool) {}

  async findByMasterId(masterId: string): Promise<Service[]> {
    const { rows } = await this.pool.query<Service>(
      `SELECT * FROM services WHERE master_id = $1 ORDER BY sort_order, created_at`,
      [masterId],
    );
    return rows;
  }

  async findById(id: string): Promise<Service | null> {
    const { rows } = await this.pool.query<Service>(
      `SELECT * FROM services WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async create(masterId: string, input: CreateServiceInput): Promise<Service> {
    const { rows } = await this.pool.query<Service>(
      `INSERT INTO services (master_id, name, description, duration_min, price, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [masterId, input.name, input.description ?? null, input.duration_min, input.price, input.sort_order ?? 0],
    );
    return rows[0];
  }

  async update(id: string, masterId: string, input: UpdateServiceInput): Promise<Service | null> {
    const keys = Object.keys(input) as (keyof UpdateServiceInput)[];
    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
    const values: unknown[] = [id, masterId, ...keys.map(k => input[k])];

    const { rows } = await this.pool.query<Service>(
      `UPDATE services SET ${setClauses} WHERE id = $1 AND master_id = $2 RETURNING *`,
      values,
    );
    return rows[0] ?? null;
  }

  async delete(id: string, masterId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM services WHERE id = $1 AND master_id = $2`,
      [id, masterId],
    );
    return (rowCount ?? 0) > 0;
  }
}
