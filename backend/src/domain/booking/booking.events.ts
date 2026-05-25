export interface BookingCreatedEvent {
  type: 'BookingCreated';
  bookingId: string;
  masterId: string;
  masterTelegramId: number;
  masterName: string;
  clientTelegramId: number;
  clientName: string;
  startTime: Date;
}

export interface BookingCancelledEvent {
  type: 'BookingCancelled';
  bookingId: string;
  masterId: string;
  clientTelegramId: number;
  startTime: Date;
}
