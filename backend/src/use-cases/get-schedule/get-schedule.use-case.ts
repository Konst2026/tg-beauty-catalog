import type { IScheduleRepository } from '@/domain/ports/schedule.repo.port';

export class GetScheduleUseCase {
  constructor(private readonly repo: IScheduleRepository) {}

  execute(masterId: string) {
    return this.repo.getWeeklyTemplate(masterId);
  }
}
