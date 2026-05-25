import type { IScheduleRepository } from '@/domain/ports/schedule.repo.port';
import type { UpsertOverrideInput } from '@/domain/schedule/schedule.entity';
import { DomainError } from '@/shared/errors/domain-error';

export class UpsertOverrideUseCase {
  constructor(private readonly repo: IScheduleRepository) {}

  execute(masterId: string, input: UpsertOverrideInput) {
    if (input.is_working && input.start_time && input.end_time) {
      if (input.start_time >= input.end_time) {
        throw new DomainError('start_time must be before end_time', 'INVALID_SCHEDULE_TIME');
      }
    }
    return this.repo.upsertOverride(masterId, input);
  }
}
