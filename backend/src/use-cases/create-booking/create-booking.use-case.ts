import type { Booking, CreateBookingInput } from '@/domain/booking/booking.entity';
import type { BookingCreatedEvent } from '@/domain/booking/booking.events';
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';
import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import type { IEventBus } from '@/domain/ports/event-bus.port';
import { DomainError } from '@/shared/errors/domain-error';

export { DomainError };

export class CreateBookingUseCase {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly masterRepo: IMasterRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: CreateBookingInput): Promise<Booking> {
    const master = await this.masterRepo.findById(input.master_id);
    if (!master)              throw new DomainError('Master not found', 'MASTER_NOT_FOUND');
    if (!master.is_published) throw new DomainError('Master is not available', 'MASTER_UNAVAILABLE');

    const booking = await this.bookingRepo.create(input);

    const event: BookingCreatedEvent = {
      type:             'BookingCreated',
      bookingId:        booking.id,
      masterId:         master.id,
      masterTelegramId: master.telegram_id,
      masterName:       master.full_name,
      clientTelegramId: booking.client_telegram_id,
      clientName:       booking.client_name ?? input.client_name,
      startTime:        booking.start_time,
    };
    await this.eventBus.publish(event);

    return booking;
  }
}
