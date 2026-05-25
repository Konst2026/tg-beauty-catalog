import type { IScheduleRepository } from '@/domain/ports/schedule.repo.port';

export class GetOverridesUseCase {
  constructor(private readonly repo: IScheduleRepository) {}

  execute(masterId: string, from: string, to: string) {
    return this.repo.getOverrides(masterId, from, to);
  }
}
