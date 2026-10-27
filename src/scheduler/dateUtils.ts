export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getWeekdayMondayZero(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatLocalDateTime(dateKey: string, minute: number): string {
  const date = fromDateKey(dateKey);
  date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function localDateTimeToMinutes(value: string): { date: string; minute: number } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid local date-time: ${value}`);
  return { date: toDateKey(date), minute: minutesSinceMidnight(date) };
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  next.setHours(0, 0, 0, 0);
  return next;
}
