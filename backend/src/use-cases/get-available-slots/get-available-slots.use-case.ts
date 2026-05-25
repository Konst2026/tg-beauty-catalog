import type { IScheduleRepository } from '@/domain/ports/schedule.repo.port';
import type { IServiceRepository }  from '@/domain/ports/service.repo.port';
import { calculateSlots, type Slot } from '@/domain/schedule/slot-calculator';
import { DomainError }               from '@/shared/errors/domain-error';

export interface GetAvailableSlotsInput {
  masterId:   string;
  serviceId:  string;
  date:       string; // 'YYYY-MM-DD'
}

export class GetAvailableSlotsUseCase {
  constructor(
    private readonly scheduleRepo: IScheduleRepository,
    private readonly serviceRepo:  IServiceRepository,
  ) {}

  async execute(input: GetAvailableSlotsInput): Promise<Slot[]> {
    const { masterId, serviceId, date } = input;

    const service = await this.serviceRepo.findById(serviceId);
    if (!service || !service.is_active) {
      throw new DomainError('Service not found', 'SERVICE_NOT_FOUND');
    }

    // Check date-specific override first
    const [year, month, day] = date.split('-').map(Number);
    const jsDay = new Date(year, month - 1, day).getDay(); // 0=Sun

    const overrides = await this.scheduleRepo.getOverrides(masterId, date, date);
    const override  = overrides[0] ?? null;

    let workStart: string;
    let workEnd:   string;

    if (override) {
      if (!override.is_working) return [];
      workStart = override.start_time!;
      workEnd   = override.end_time!;
    } else {
      const template = await this.scheduleRepo.getWeeklyTemplate(masterId);
      const dayEntry = template.find(s => s.day_of_week === jsDay);
      if (!dayEntry?.is_working || !dayEntry.start_time || !dayEntry.end_time) return [];
      workStart = dayEntry.start_time;
      workEnd   = dayEntry.end_time;
    }

    const bookedRanges = await this.scheduleRepo.getBookedRanges(masterId, date);

    return calculateSlots({
      date,
      workStart,
      workEnd,
      durationMin:  service.duration_min,
      bookedRanges,
    });
  }
}
