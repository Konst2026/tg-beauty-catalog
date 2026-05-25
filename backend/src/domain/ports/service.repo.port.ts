import type { Service, CreateServiceInput, UpdateServiceInput } from '@/domain/service/service.entity';

export interface IServiceRepository {
  findByMasterId(masterId: string): Promise<Service[]>;
  findById(id: string): Promise<Service | null>;
  create(masterId: string, input: CreateServiceInput): Promise<Service>;
  update(id: string, masterId: string, input: UpdateServiceInput): Promise<Service | null>;
  delete(id: string, masterId: string): Promise<boolean>;
}
