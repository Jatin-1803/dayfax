import type { AnalyticsRangeInput } from './business-analytics.schema.js';

export interface DateRange {
  from: Date;
  to: Date;
  fromYmd: string;
  toYmd: string;
  preset: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function parseYmd(ymd: string): Date {
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(y, m - 1, day);
}

/** Resolve analytics window in local server time; filter uses orders.placed_at. */
export function resolveAnalyticsRange(input: AnalyticsRangeInput, now = new Date()): DateRange {
  const today = startOfDay(now);
  let from = today;
  let to = endOfDay(now);
  const preset = input.preset ?? 'last_30_days';

  switch (preset) {
    case 'today':
      from = today;
      to = endOfDay(now);
      break;
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      from = startOfDay(y);
      to = endOfDay(y);
      break;
    }
    case 'last_7_days': {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      from = startOfDay(s);
      to = endOfDay(now);
      break;
    }
    case 'last_30_days': {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      from = startOfDay(s);
      to = endOfDay(now);
      break;
    }
    case 'this_month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = endOfDay(now);
      break;
    case 'last_month': {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      to = endOfDay(lastDay);
      break;
    }
    case 'this_year':
      from = new Date(now.getFullYear(), 0, 1);
      to = endOfDay(now);
      break;
    case 'custom':
      from = startOfDay(parseYmd(input.from!));
      to = endOfDay(parseYmd(input.to!));
      break;
    default:
      break;
  }

  return {
    from,
    to,
    fromYmd: formatYmd(from),
    toYmd: formatYmd(to),
    preset,
  };
}
