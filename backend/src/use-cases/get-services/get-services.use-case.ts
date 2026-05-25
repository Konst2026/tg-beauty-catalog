import type { IServiceRepository } from '@/domain/ports/service.repo.port';

export class GetServicesUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  execute(masterId: string) {
    return this.repo.findByMasterId(masterId);
  }
}
