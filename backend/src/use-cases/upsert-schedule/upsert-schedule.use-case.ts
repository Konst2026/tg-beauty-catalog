import type { IScheduleRepository } from '@/domain/ports/schedule.repo.port';
import type { UpsertScheduleInput } from '@/domain/schedule/schedule.entity';
import { DomainError } from '@/shared/errors/domain-error';

export class UpsertScheduleUseCase {
  constructor(private readonly repo: IScheduleRepository) {}

  execute(masterId: string, input: UpsertScheduleInput) {
    if (input.is_working && input.start_time && input.end_time) {
      if (input.start_time >= input.end_time) {
        throw new DomainError('start_time must be before end_time', 'INVALID_SCHEDULE_TIME');
      }
    }
    return this.repo.upsertDay(masterId, input);
  }
}
