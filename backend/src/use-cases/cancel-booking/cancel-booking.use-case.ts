import type { Booking } from '@/domain/booking/booking.entity';
import type { BookingCancelledEvent } from '@/domain/booking/booking.events';
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';
import type { IEventBus } from '@/domain/ports/event-bus.port';

export class CancelBookingUseCase {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(bookingId: string, clientTelegramId: number): Promise<Booking | null> {
    const booking = await this.bookingRepo.cancelByClient(bookingId, clientTelegramId);

    if (booking) {
      const event: BookingCancelledEvent = {
        type:             'BookingCancelled',
        bookingId:        booking.id,
        masterId:         booking.master_id,
        clientTelegramId: booking.client_telegram_id,
        startTime:        booking.start_time,
      };
      await this.eventBus.publish(event);
    }

    return booking;
  }
}
