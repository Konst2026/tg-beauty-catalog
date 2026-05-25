import type { Booking, CreateBookingInput } from '@/domain/booking/booking.entity';

export interface IBookingRepository {
  create(input: CreateBookingInput): Promise<Booking>;
  findByClientTelegramId(telegramId: number): Promise<Booking[]>;
  findByMasterId(masterId: string): Promise<Booking[]>;
  cancel(id: string, cancelledBy: 'client' | 'master'): Promise<Booking | null>;
  cancelByClient(id: string, clientTelegramId: number): Promise<Booking | null>;
}
