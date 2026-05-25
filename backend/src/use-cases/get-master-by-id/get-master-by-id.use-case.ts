import type { MasterWithServices } from '@/domain/master/master.entity';
import type { IMasterRepository } from '@/domain/ports/master.repo.port';

export class GetMasterByIdUseCase {
  constructor(private readonly masterRepo: IMasterRepository) {}

  async execute(id: string): Promise<MasterWithServices | null> {
    return this.masterRepo.findById(id);
  }
}
