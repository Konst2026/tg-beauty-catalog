import type { IScheduleRepository } from '@/domain/ports/schedule.repo.port';
import { DomainError } from '@/shared/errors/domain-error';

export class DeleteOverrideUseCase {
  constructor(private readonly repo: IScheduleRepository) {}

  async execute(id: string, masterId: string) {
    const deleted = await this.repo.deleteOverride(id, masterId);
    if (!deleted) throw new DomainError('Override not found', 'OVERRIDE_NOT_FOUND');
  }
}
