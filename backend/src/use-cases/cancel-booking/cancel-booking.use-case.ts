import type { Booking } from '@/domain/booking/booking.entity';
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';

export class CancelBookingUseCase {
  constructor(private readonly bookingRepo: IBookingRepository) {}

  async execute(bookingId: string, clientTelegramId: number): Promise<Booking | null> {
    return this.bookingRepo.cancelByClient(bookingId, clientTelegramId);
  }
}
