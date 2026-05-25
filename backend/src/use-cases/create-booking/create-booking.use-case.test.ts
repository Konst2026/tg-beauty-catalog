import { describe, it, expect, vi } from 'vitest';
import { CreateBookingUseCase } from './create-booking.use-case';
import type { IBookingRepository } from '@/domain/ports/booking.repo.port';
import type { IMasterRepository } from '@/domain/ports/master.repo.port';
import type { IEventBus } from '@/domain/ports/event-bus.port';
import type { Booking } from '@/domain/booking/booking.entity';
import type { Master } from '@/domain/master/master.entity';
import { DomainError } from '@/shared/errors/domain-error';

const mockMaster: Partial<Master> = {
  id: 'master-uuid',
  telegram_id: 123,
  is_published: true,
  full_name: 'Test Master',
  plan: 'trial',
};

const mockBooking: Booking = {
  id: 'booking-uuid',
  master_id: 'master-uuid',
  service_id: 'service-uuid',
  client_telegram_id: 111,
  client_name: 'Test Client',
  start_time: new Date('2026-06-01T10:00:00Z'),
  end_time:   new Date('2026-06-01T11:00:00Z'),
  status: 'confirmed',
  price_snapshot: 1500,
  notes: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const baseInput = {
  master_id:          'master-uuid',
  service_id:         'service-uuid',
  client_telegram_id: 111,
  client_name:        'Test Client',
  start_time:         new Date('2026-06-01T10:00:00Z'),
  end_time:           new Date('2026-06-01T11:00:00Z'),
  price_snapshot:     1500,
};

function makeMocks(overrides?: {
  masterResult?: Master | null;
  bookingResult?: Booking;
}) {
  const masterResult = overrides && 'masterResult' in overrides ? overrides.masterResult : mockMaster;
  const bookingRepo: IBookingRepository = {
    create:                  vi.fn().mockResolvedValue(overrides?.bookingResult ?? mockBooking),
    findByClientTelegramId:  vi.fn(),
    findByMasterId:          vi.fn(),
    cancel:                  vi.fn(),
    cancelByClient:          vi.fn(),
    deletePendingExpired:    vi.fn(),
  };
  const masterRepo: IMasterRepository = {
    findById:            vi.fn().mockResolvedValue(masterResult),
    findAll:             vi.fn(),
    findByTelegramId:    vi.fn(),
    findByTokenHash:     vi.fn(),
    findBotCredentials:  vi.fn(),
    upsert:              vi.fn(),
    updateBotInfo:       vi.fn(),
    findExpiredTrials:   vi.fn(),
    findExpiringTrials:  vi.fn(),
    updatePlan:          vi.fn(),
  };
  const eventBus: IEventBus = {
    publish:   vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
  };
  return { bookingRepo, masterRepo, eventBus };
}

describe('CreateBookingUseCase', () => {
  it('creates booking when master exists and is published', async () => {
    const { bookingRepo, masterRepo, eventBus } = makeMocks();
    const uc = new CreateBookingUseCase(bookingRepo, masterRepo, eventBus);

    const result = await uc.execute(baseInput);

    expect(result).toEqual(mockBooking);
    expect(bookingRepo.create).toHaveBeenCalledWith(baseInput);
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'BookingCreated' }));
  });

  it('throws DomainError MASTER_NOT_FOUND when master does not exist', async () => {
    const { bookingRepo, masterRepo, eventBus } = makeMocks({ masterResult: null });
    const uc = new CreateBookingUseCase(bookingRepo, masterRepo, eventBus);

    await expect(uc.execute(baseInput)).rejects.toThrow(DomainError);
    await expect(uc.execute(baseInput)).rejects.toMatchObject({ code: 'MASTER_NOT_FOUND' });
    expect(bookingRepo.create).not.toHaveBeenCalled();
  });

  it('throws DomainError MASTER_UNAVAILABLE when master is not published', async () => {
    const unpublished = { ...mockMaster, is_published: false } as Master;
    const { bookingRepo, masterRepo, eventBus } = makeMocks({ masterResult: unpublished });
    const uc = new CreateBookingUseCase(bookingRepo, masterRepo, eventBus);

    await expect(uc.execute(baseInput)).rejects.toMatchObject({ code: 'MASTER_UNAVAILABLE' });
    expect(bookingRepo.create).not.toHaveBeenCalled();
  });

  it('throws DomainError MASTER_SUBSCRIPTION_EXPIRED when master plan is expired', async () => {
    const expired = { ...mockMaster, is_published: true, plan: 'expired' } as Master;
    const { bookingRepo, masterRepo, eventBus } = makeMocks({ masterResult: expired });
    const uc = new CreateBookingUseCase(bookingRepo, masterRepo, eventBus);

    await expect(uc.execute(baseInput)).rejects.toMatchObject({ code: 'MASTER_SUBSCRIPTION_EXPIRED' });
    expect(bookingRepo.create).not.toHaveBeenCalled();
  });

  it('propagates repository error (e.g. 23P01 GIST conflict) to caller', async () => {
    const { bookingRepo, masterRepo, eventBus } = makeMocks();
    const pgError = Object.assign(new Error('exclusion violation'), { code: '23P01' });
    vi.mocked(bookingRepo.create).mockRejectedValue(pgError);
    const uc = new CreateBookingUseCase(bookingRepo, masterRepo, eventBus);

    await expect(uc.execute(baseInput)).rejects.toMatchObject({ code: '23P01' });
  });
});
