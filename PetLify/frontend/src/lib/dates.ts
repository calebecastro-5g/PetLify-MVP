// All MVP shops use this zone. API timestamps include Z or an explicit offset.
export const SHOP_TIMEZONE = 'America/Sao_Paulo';

function date(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new RangeError('O horário da API deve indicar o fuso.');
  }
  return new Date(value);
}

export function formatDateTime(value: string): string {
  return date(value).toLocaleString('pt-BR', {
    timeZone: SHOP_TIMEZONE, dateStyle: 'short', timeStyle: 'short',
  });
}

export function formatDate(value: string): string {
  return date(value).toLocaleDateString('pt-BR', { timeZone: SHOP_TIMEZONE });
}

// A slot/datetime-local value already represents the shop clock, not an instant.
export function formatShopInput(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError('O horário do formulário deve usar YYYY-MM-DDTHH:mm.');
  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year}, ${hour}:${minute}`;
}

function parts(value: string | Date): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date(value)).map(({ type, value: part }) => [type, part]));
}

export function toDateTimeInput(value: string): string {
  const p = parts(value);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function monthKey(value: string | Date = new Date()): string {
  const p = parts(value);
  return `${p.year}-${p.month}`;
}

export function isToday(value: string, now = new Date()): boolean {
  const p = parts(value);
  const today = parts(now);
  return p.year === today.year && p.month === today.month && p.day === today.day;
}
