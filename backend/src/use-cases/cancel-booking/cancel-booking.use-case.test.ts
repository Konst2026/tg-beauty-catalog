import { describe, it, expect, vi } from 'vitest';
import { CancelBookingUseCase } from './cancel-booking.use-case';
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';
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

function makeRepo(result: Booking | null) {
  return {
    create:                  vi.fn(),
    findByClientTelegramId:  vi.fn(),
    findByMasterId:          vi.fn(),
    cancel:                  vi.fn(),
    cancelByClient:          vi.fn().mockResolvedValue(result),
  } as unknown as IBookingRepository;
}

describe('CancelBookingUseCase', () => {
  it('returns cancelled booking on success', async () => {
    const repo = makeRepo(cancelledBooking);
    const uc = new CancelBookingUseCase(repo);

    const result = await uc.execute('booking-uuid', 111);

    expect(result).toEqual(cancelledBooking);
    expect(repo.cancelByClient).toHaveBeenCalledWith('booking-uuid', 111);
  });

  it('returns null when booking not found or already cancelled', async () => {
    const repo = makeRepo(null);
    const uc = new CancelBookingUseCase(repo);

    const result = await uc.execute('nonexistent-uuid', 111);

    expect(result).toBeNull();
  });

  it('does not allow cancellation with wrong clientTelegramId (null returned by repo)', async () => {
    const repo = makeRepo(null);
    const uc = new CancelBookingUseCase(repo);

    const result = await uc.execute('booking-uuid', 999999);

    expect(result).toBeNull();
    expect(repo.cancelByClient).toHaveBeenCalledWith('booking-uuid', 999999);
  });
});
