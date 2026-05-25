import type { Pool } from 'pg';
import type { IScheduleRepository } from '@/domain/ports/schedule.repo.port';
import type { Schedule, ScheduleOverride, UpsertScheduleInput, UpsertOverrideInput } from '@/domain/schedule/schedule.entity';

export class PostgresSchedulesRepo implements IScheduleRepository {
  constructor(private readonly pool: Pool) {}

  async getWeeklyTemplate(masterId: string): Promise<Schedule[]> {
    const { rows } = await this.pool.query<Schedule>(
      `SELECT * FROM schedules WHERE master_id = $1 ORDER BY day_of_week`,
      [masterId],
    );
    return rows;
  }

  async upsertDay(masterId: string, input: UpsertScheduleInput): Promise<Schedule> {
    const { rows } = await this.pool.query<Schedule>(
      `INSERT INTO schedules (master_id, day_of_week, is_working, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (master_id, day_of_week) DO UPDATE
         SET is_working = EXCLUDED.is_working,
             start_time = EXCLUDED.start_time,
             end_time   = EXCLUDED.end_time
       RETURNING *`,
      [masterId, input.day_of_week, input.is_working, input.start_time ?? null, input.end_time ?? null],
    );
    return rows[0];
  }

  async getOverrides(masterId: string, from: string, to: string): Promise<ScheduleOverride[]> {
    const { rows } = await this.pool.query<ScheduleOverride>(
      `SELECT * FROM schedule_overrides
       WHERE master_id = $1 AND override_date BETWEEN $2 AND $3
       ORDER BY override_date`,
      [masterId, from, to],
    );
    return rows;
  }

  async upsertOverride(masterId: string, input: UpsertOverrideInput): Promise<ScheduleOverride> {
    const { rows } = await this.pool.query<ScheduleOverride>(
      `INSERT INTO schedule_overrides (master_id, override_date, is_working, start_time, end_time, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (master_id, override_date) DO UPDATE
         SET is_working  = EXCLUDED.is_working,
             start_time  = EXCLUDED.start_time,
             end_time    = EXCLUDED.end_time,
             reason      = EXCLUDED.reason
       RETURNING *`,
      [masterId, input.override_date, input.is_working, input.start_time ?? null, input.end_time ?? null, input.reason ?? null],
    );
    return rows[0];
  }

  async deleteOverride(id: string, masterId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM schedule_overrides WHERE id = $1 AND master_id = $2`,
      [id, masterId],
    );
    return (rowCount ?? 0) > 0;
  }

  async getBookedRanges(masterId: string, date: string): Promise<Array<{ start: Date; end: Date }>> {
    const { rows } = await this.pool.query<{ start_time: Date; end_time: Date }>(
      `SELECT start_time, end_time FROM bookings
       WHERE master_id = $1
         AND status IN ('confirmed', 'pending')
         AND start_time::date = $2::date`,
      [masterId, date],
    );
    return rows.map(r => ({ start: r.start_time, end: r.end_time }));
  }
}
