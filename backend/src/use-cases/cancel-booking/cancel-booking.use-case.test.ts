import { describe, it, expect, vi } from 'vitest';
import { CancelBookingUseCase } from './cancel-booking.use-case';
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';
import type { IEventBus } from '@/domain/ports/event-bus.port';
import type { Booking } from '@/domain/booking/booking.entity';

const cancelledBooking: Booking = {
  id: 'booking-uuid',
  master_id: 'master-uuid',
  service_id: 'service-uuid',
  client_telegram_id: 111,
  client_name: 'Test Client',
  start_time: new Date('2026-06-01T10:00:00Z'),
  end_time:   new Date('2026-06-01T11:00:00Z'),
  status: 'cancelled',
  price_snapshot: 1500,
  notes: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeMocks(result: Booking | null) {
  const bookingRepo = {
    create:                  vi.fn(),
    findByClientTelegramId:  vi.fn(),
    findByMasterId:          vi.fn(),
    cancel:                  vi.fn(),
    cancelByClient:          vi.fn().mockResolvedValue(result),
  } as unknown as IBookingRepository;
  const eventBus: IEventBus = {
    publish:   vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
  };
  return { bookingRepo, eventBus };
}

describe('CancelBookingUseCase', () => {
  it('returns cancelled booking on success', async () => {
    const { bookingRepo, eventBus } = makeMocks(cancelledBooking);
    const uc = new CancelBookingUseCase(bookingRepo, eventBus);

    const result = await uc.execute('booking-uuid', 111);

    expect(result).toEqual(cancelledBooking);
    expect(bookingRepo.cancelByClient).toHaveBeenCalledWith('booking-uuid', 111);
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'BookingCancelled' }));
  });

  it('returns null when booking not found or already cancelled', async () => {
    const { bookingRepo, eventBus } = makeMocks(null);
    const uc = new CancelBookingUseCase(bookingRepo, eventBus);

    const result = await uc.execute('nonexistent-uuid', 111);

    expect(result).toBeNull();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('does not allow cancellation with wrong clientTelegramId (null returned by repo)', async () => {
    const { bookingRepo, eventBus } = makeMocks(null);
    const uc = new CancelBookingUseCase(bookingRepo, eventBus);

    const result = await uc.execute('booking-uuid', 999999);

    expect(result).toBeNull();
    expect(bookingRepo.cancelByClient).toHaveBeenCalledWith('booking-uuid', 999999);
  });
});
