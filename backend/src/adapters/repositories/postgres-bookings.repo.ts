import type { Pool } from 'pg';
import type { Booking, CreateBookingInput } from '@/domain/booking/booking.entity';
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';

export class PostgresBookingsRepo implements IBookingRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateBookingInput): Promise<Booking> {
    const { rows } = await this.pool.query<Booking>(
      `INSERT INTO bookings
         (master_id, service_id, client_telegram_id, client_name,
          start_time, end_time, status, price_snapshot, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, $8)
       RETURNING *`,
      [
        input.master_id, input.service_id, input.client_telegram_id,
        input.client_name, input.start_time, input.end_time,
        input.price_snapshot, input.notes ?? null,
      ],
    );
    return rows[0];
  }

  async findByClientTelegramId(telegramId: number): Promise<Booking[]> {
    const { rows } = await this.pool.query<Booking>(
      `SELECT b.*,
              s.name      AS service_name,
              m.full_name AS master_name,
              m.avatar_url AS master_avatar_url
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN masters  m ON m.id = b.master_id
       WHERE b.client_telegram_id = $1
       ORDER BY b.start_time DESC
       LIMIT 50`,
      [telegramId],
    );
    return rows;
  }

  async findByMasterId(masterId: string): Promise<Booking[]> {
    const { rows } = await this.pool.query<Booking>(
      `SELECT b.*, s.name AS service_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       WHERE b.master_id = $1 AND b.status IN ('confirmed', 'pending')
       ORDER BY b.start_time ASC`,
      [masterId],
    );
    return rows;
  }

  async cancel(id: string, cancelledBy: 'client' | 'master'): Promise<Booking | null> {
    const { rows } = await this.pool.query<Booking>(
      `UPDATE bookings
       SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2, updated_at = now()
       WHERE id = $1 AND status IN ('confirmed', 'pending')
       RETURNING *`,
      [id, cancelledBy],
    );
    return rows[0] ?? null;
  }

  async cancelByClient(id: string, clientTelegramId: number): Promise<Booking | null> {
    const { rows } = await this.pool.query<Booking>(
      `UPDATE bookings
       SET status = 'cancelled', cancelled_at = now(), cancelled_by = 'client', updated_at = now()
       WHERE id = $1 AND client_telegram_id = $2 AND status IN ('confirmed', 'pending')
       RETURNING *`,
      [id, clientTelegramId],
    );
    return rows[0] ?? null;
  }
}
