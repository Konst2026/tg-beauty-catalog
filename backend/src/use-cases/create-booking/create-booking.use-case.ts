import type { Booking, CreateBookingInput } from '@/domain/booking/booking.entity';
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';
import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import { DomainError } from '@/shared/errors/domain-error';

export { DomainError };

export class CreateBookingUseCase {
  constructor(
    private readonly bookingRepo: IBookingRepository,
    private readonly masterRepo: IMasterRepository,
  ) {}

  async execute(input: CreateBookingInput): Promise<Booking> {
    const master = await this.masterRepo.findById(input.master_id);
    if (!master)             throw new DomainError('Master not found', 'MASTER_NOT_FOUND');
    if (!master.is_published) throw new DomainError('Master is not available', 'MASTER_UNAVAILABLE');

    return this.bookingRepo.create(input);
  }
}
