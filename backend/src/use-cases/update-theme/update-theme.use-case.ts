import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import type { UpdateThemeInput }  from '@/domain/master/master.entity';
import { DomainError }            from '@/shared/errors/domain-error';

export class UpdateThemeUseCase {
  constructor(private readonly mastersRepo: IMasterRepository) {}

  async execute(masterId: string, input: UpdateThemeInput): Promise<void> {
    const master = await this.mastersRepo.findById(masterId);
    if (!master) throw new DomainError('Master not found', 'MASTER_NOT_FOUND');
    await this.mastersRepo.updateTheme(masterId, input);
  }
}
