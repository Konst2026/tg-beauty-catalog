import type { Pool } from 'pg';
import type { Master, MasterWithServices, UpdateMasterInput, UpdateThemeInput, MasterBotCredentials, BotUpdateData } from '@/domain/master/master.entity';
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

  async findByTokenHash(tokenHash: string): Promise<Master | null> {
    const { rows } = await this.pool.query<Master>(
      `SELECT id, telegram_id, username, full_name, bio, specialty, category_id, city,
              avatar_url, promo_text, available_today, rating, review_count, bot_username,
              bot_token_hash, bot_webhook_secret, plan, is_published, created_at, updated_at
       FROM masters WHERE bot_token_hash = $1`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async findBotCredentials(masterId: string): Promise<MasterBotCredentials | null> {
    const { rows } = await this.pool.query<MasterBotCredentials>(
      'SELECT id, bot_token FROM masters WHERE id = $1',
      [masterId],
    );
    return rows[0] ?? null;
  }

  async updateBotInfo(masterId: string, data: BotUpdateData): Promise<void> {
    const keys  = Object.keys(data) as (keyof BotUpdateData)[];
    if (keys.length === 0) return;
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values: unknown[] = [masterId, ...keys.map(k => data[k])];
    await this.pool.query(
      `UPDATE masters SET ${setClauses}, updated_at = now() WHERE id = $1`,
      values,
    );
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

  async findExpiredTrials(): Promise<Master[]> {
    const { rows } = await this.pool.query<Master>(
      `SELECT * FROM masters WHERE plan = 'trial' AND trial_ends_at < now()`,
    );
    return rows;
  }

  async findExpiringTrials(daysUntil: number): Promise<Master[]> {
    const { rows } = await this.pool.query<Master>(
      `SELECT * FROM masters
       WHERE plan = 'trial'
         AND trial_ends_at >= now() + ($1 - 1) * INTERVAL '1 day'
         AND trial_ends_at <  now() + $1       * INTERVAL '1 day'`,
      [daysUntil],
    );
    return rows;
  }

  async updatePlan(masterId: string, plan: Master['plan'], paidUntil?: Date): Promise<void> {
    await this.pool.query(
      `UPDATE masters
       SET plan = $2, plan_paid_until = $3, updated_at = now()
       WHERE id = $1`,
      [masterId, plan, paidUntil ?? null],
    );
  }

  async updateTheme(masterId: string, input: UpdateThemeInput): Promise<void> {
    const colMap: Record<keyof UpdateThemeInput, string> = {
      primary_color: 'theme_primary_color',
      logo_url:      'theme_logo_url',
      name:          'theme_name',
    };
    const keys = (Object.keys(input) as (keyof UpdateThemeInput)[]).filter(k => k in input);
    if (keys.length === 0) return;
    const setClauses = keys.map((k, i) => `${colMap[k]} = $${i + 2}`).join(', ');
    const values: unknown[] = [masterId, ...keys.map(k => input[k])];
    await this.pool.query(
      `UPDATE masters SET ${setClauses}, updated_at = now() WHERE id = $1`,
      values,
    );
  }
}
