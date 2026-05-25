import type { IServiceRepository } from '@/domain/ports/service.repo.port';
import { DomainError } from '@/shared/errors/domain-error';

export class DeleteServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(id: string, masterId: string) {
    const deleted = await this.repo.delete(id, masterId);
    if (!deleted) throw new DomainError('Service not found', 'SERVICE_NOT_FOUND');
  }
}
