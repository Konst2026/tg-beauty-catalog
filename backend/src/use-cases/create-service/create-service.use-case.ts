import type { IServiceRepository } from '@/domain/ports/service.repo.port';
import type { CreateServiceInput } from '@/domain/service/service.entity';
import { DomainError } from '@/shared/errors/domain-error';

const MAX_SERVICES = 50;

export class CreateServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(masterId: string, input: CreateServiceInput) {
    const existing = await this.repo.findByMasterId(masterId);
    if (existing.length >= MAX_SERVICES) {
      throw new DomainError(`Service limit reached (${MAX_SERVICES} max)`, 'SERVICE_LIMIT_REACHED');
    }
    return this.repo.create(masterId, input);
  }
}
