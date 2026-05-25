import type { Pool } from 'pg';
import type { Master, MasterWithServices, UpdateMasterInput } from '@/domain/master/master.entity';
import type { IMasterRepository, GetMastersFilter } from '@/domain/ports/master.repo.port';

export class PostgresMastersRepo implements IMasterRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(filter: GetMastersFilter = {}): Promise<Master[]> {
    const conditions: string[] = ['m.is_published = true'];
    const values: unknown[] = [];

    if (filter.category_id) {
      values.push(filter.category_id);
      conditions.push(`m.category_id = $${values.length}`);
    }
    if (filter.city) {
      values.push(`%${filter.city}%`);
      conditions.push(`m.city ILIKE $${values.length}`);
    }
    if (filter.available_today !== undefined) {
      values.push(filter.available_today);
      conditions.push(`m.available_today = $${values.length}`);
    }

    const { rows } = await this.pool.query<Master>(
      `SELECT m.id, m.telegram_id, m.username, m.full_name, m.bio, m.specialty,
              m.category_id, m.city, m.avatar_url, m.promo_text, m.available_today,
              m.rating, m.review_count, m.bot_username, m.plan, m.is_published,
              m.created_at, m.updated_at,
              c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji
       FROM masters m
       LEFT JOIN categories c ON c.id = m.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.rating DESC, m.review_count DESC`,
      values,
    );
    return rows;
  }

  async findById(id: string): Promise<MasterWithServices | null> {
    const { rows: masters } = await this.pool.query<Master>(
      `SELECT m.*, c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji
       FROM masters m
       LEFT JOIN categories c ON c.id = m.category_id
       WHERE m.id = $1`,
      [id],
    );
    if (!masters[0]) return null;

    const { rows: services } = await this.pool.query(
      `SELECT id, name, duration_min, price
       FROM services WHERE master_id = $1 AND is_active = true ORDER BY sort_order`,
      [id],
    );

    return { ...masters[0], services };
  }

  async findByTelegramId(telegramId: number): Promise<Master | null> {
    const { rows } = await this.pool.query<Master>(
      'SELECT * FROM masters WHERE telegram_id = $1',
      [telegramId],
    );
    return rows[0] ?? null;
  }

  async upsert(telegramId: number, data: UpdateMasterInput): Promise<Master> {
    const keys = Object.keys(data) as (keyof UpdateMasterInput)[];
    const values: unknown[] = [telegramId];

    // INSERT with known columns, UPDATE on conflict
    const insertCols = ['telegram_id', ...keys].join(', ');
    const insertVals = ['$1', ...keys.map((_, i) => `$${i + 2}`)].join(', ');
    const updateClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    keys.forEach(k => values.push(data[k]));

    const { rows } = await this.pool.query<Master>(
      `INSERT INTO masters (${insertCols})
       VALUES (${insertVals})
       ON CONFLICT (telegram_id) DO UPDATE
       SET ${updateClauses}, updated_at = now()
       RETURNING *`,
      values,
    );
    return rows[0];
  }
}
