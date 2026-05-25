import type { IServiceRepository } from '@/domain/ports/service.repo.port';
import type { UpdateServiceInput } from '@/domain/service/service.entity';
import { DomainError } from '@/shared/errors/domain-error';

export class UpdateServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(id: string, masterId: string, input: UpdateServiceInput) {
    const service = await this.repo.update(id, masterId, input);
    if (!service) throw new DomainError('Service not found', 'SERVICE_NOT_FOUND');
    return service;
  }
}
