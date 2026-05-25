export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
  id: string;
  master_id: string;
  service_id: string;
  client_telegram_id: number;
  client_name: string | null;
  start_time: Date;
  end_time: Date;
  status: BookingStatus;
  price_snapshot: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBookingInput {
  master_id: string;
  service_id: string;
  client_telegram_id: number;
  client_name: string;
  start_time: Date;
  end_time: Date;
  price_snapshot: number;
  notes?: string;
}
