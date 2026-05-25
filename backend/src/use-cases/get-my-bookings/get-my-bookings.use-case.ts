import type { Booking } from '@/domain/booking/booking.entity';
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';

export class GetMyBookingsUseCase {
  constructor(private readonly bookingRepo: IBookingRepository) {}

  async execute(clientTelegramId: number): Promise<Booking[]> {
    return this.bookingRepo.findByClientTelegramId(clientTelegramId);
  }
}
