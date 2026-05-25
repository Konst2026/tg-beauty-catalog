import type { Master, MasterWithServices, UpdateMasterInput } from '@/domain/master/master.entity';

export interface GetMastersFilter {
  category_id?:    string;
  city?:           string;
  available_today?: boolean;
}

export interface IMasterRepository {
  findAll(filter?: GetMastersFilter): Promise<Master[]>;
  findById(id: string): Promise<MasterWithServices | null>;
  findByTelegramId(telegramId: number): Promise<Master | null>;
  upsert(telegramId: number, data: UpdateMasterInput): Promise<Master>;
}
