export interface SlotInput {
  date:         string;           // 'YYYY-MM-DD'
  workStart:    string;           // 'HH:MM'
  workEnd:      string;           // 'HH:MM'
  durationMin:  number;
  bookedRanges: Array<{ start: Date; end: Date }>;
}

export interface Slot {
  start: string; // ISO
  end:   string; // ISO
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toISO(date: string, totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${date}T${h}:${m}:00.000Z`;
}

function overlaps(slotStart: number, slotEnd: number, booked: Array<{ start: Date; end: Date }>, date: string): boolean {
  const base = new Date(`${date}T00:00:00.000Z`).getTime();
  const s = base + slotStart * 60_000;
  const e = base + slotEnd   * 60_000;
  return booked.some(b => s < b.end.getTime() && e > b.start.getTime());
}

export function calculateSlots(input: SlotInput): Slot[] {
  const { date, workStart, workEnd, durationMin, bookedRanges } = input;
  const start = toMinutes(workStart);
  const end   = toMinutes(workEnd);
  const slots: Slot[] = [];

  for (let t = start; t + durationMin <= end; t += durationMin) {
    if (!overlaps(t, t + durationMin, bookedRanges, date)) {
      slots.push({ start: toISO(date, t), end: toISO(date, t + durationMin) });
    }
  }
  return slots;
}
