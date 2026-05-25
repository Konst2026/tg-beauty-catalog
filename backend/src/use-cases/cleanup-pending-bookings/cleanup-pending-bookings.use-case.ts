import type { IBookingRepository } from '@/domain/ports/booking.repo.port';

export class CleanupPendingBookingsUseCase {
  constructor(private readonly bookingRepo: IBookingRepository) {}

  async execute(): Promise<number> {
    return this.bookingRepo.deletePendingExpired();
  }
}
