import type { Master } from '@/domain/master/master.entity';
import type { IMasterRepository, GetMastersFilter } from '@/domain/ports/master.repo.port';

export class GetMastersUseCase {
  constructor(private readonly masterRepo: IMasterRepository) {}

  async execute(filter?: GetMastersFilter): Promise<Master[]> {
    return this.masterRepo.findAll(filter);
  }
}
