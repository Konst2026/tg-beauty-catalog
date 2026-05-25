import type { Schedule, ScheduleOverride, UpsertScheduleInput, UpsertOverrideInput } from '@/domain/schedule/schedule.entity';

export interface IScheduleRepository {
  getWeeklyTemplate(masterId: string): Promise<Schedule[]>;
  upsertDay(masterId: string, input: UpsertScheduleInput): Promise<Schedule>;
  getOverrides(masterId: string, from: string, to: string): Promise<ScheduleOverride[]>;
  upsertOverride(masterId: string, input: UpsertOverrideInput): Promise<ScheduleOverride>;
  deleteOverride(id: string, masterId: string): Promise<boolean>;
  getBookedRanges(masterId: string, date: string): Promise<Array<{ start: Date; end: Date }>>;
}
