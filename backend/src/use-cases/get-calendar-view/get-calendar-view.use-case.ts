import type { CalendarDay, CalendarBooking } from '@/domain/schedule/schedule.entity';
import type { IScheduleRepository } from '@/domain/ports/schedule.repo.port';

export class GetCalendarViewUseCase {
  constructor(private readonly scheduleRepo: IScheduleRepository) {}

  async execute(masterId: string, from: string, to: string): Promise<CalendarDay[]> {
    const [template, overrides, bookings] = await Promise.all([
      this.scheduleRepo.getWeeklyTemplate(masterId),
      this.scheduleRepo.getOverrides(masterId, from, to),
      this.scheduleRepo.getBookingsForCalendar(masterId, from, to),
    ]);

    const days: CalendarDay[] = [];
    const cursor = new Date(from + 'T00:00:00Z');
    const end    = new Date(to   + 'T00:00:00Z');

    while (cursor <= end) {
      const dateStr  = cursor.toISOString().slice(0, 10);
      const override = overrides.find(o => o.override_date === dateStr);
      const tmpl     = template.find(t => t.day_of_week === cursor.getUTCDay());

      const is_working = override ? override.is_working : (tmpl?.is_working ?? false);
      const startTime  = override ? override.start_time : (tmpl?.start_time ?? null);
      const endTime    = override ? override.end_time   : (tmpl?.end_time   ?? null);

      const dayBookings: CalendarBooking[] = bookings.filter(
        b => b.start_time.toISOString().slice(0, 10) === dateStr,
      );

      days.push({
        date: dateStr,
        is_working,
        hours: is_working && startTime && endTime ? { start: startTime, end: endTime } : null,
        bookings: dayBookings,
        override_id: override?.id ?? null,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  }
}
