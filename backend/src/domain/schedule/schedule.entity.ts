export interface Schedule {
  id:          string;
  master_id:   string;
  day_of_week: number; // 0=Sun … 6=Sat
  is_working:  boolean;
  start_time:  string | null; // 'HH:MM'
  end_time:    string | null;
}

export interface ScheduleOverride {
  id:            string;
  master_id:     string;
  override_date: string; // 'YYYY-MM-DD'
  is_working:    boolean;
  start_time:    string | null;
  end_time:      string | null;
  reason:        string | null;
}

export interface UpsertScheduleInput {
  day_of_week: number;
  is_working:  boolean;
  start_time?: string | null;
  end_time?:   string | null;
}

export interface UpsertOverrideInput {
  override_date: string;
  is_working:    boolean;
  start_time?:   string | null;
  end_time?:     string | null;
  reason?:       string | null;
}

export interface CalendarBooking {
  id:           string;
  start_time:   Date;
  end_time:     Date;
  client_name:  string | null;
  service_name: string;
  status:       string;
}

export interface CalendarDay {
  date:        string; // 'YYYY-MM-DD'
  is_working:  boolean;
  hours:       { start: string; end: string } | null;
  bookings:    CalendarBooking[];
  override_id: string | null;
}
