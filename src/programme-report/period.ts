import dayjs, { type Dayjs } from 'dayjs';

export type PeriodKind = 'month' | 'quarter';

export interface Period {
  /** The period's first day, as YYYY-MM-DD, which identifies it among the choices. */
  key: string;
  start: Dayjs;
  end: Dayjs;
  label: string;
}

const choices = { month: 12, quarter: 4 };

function quarterStart(day: Dayjs) {
  return day.startOf('month').month(Math.floor(day.month() / 3) * 3);
}

/** The current month or quarter and those before it, newest first: a year of either. */
export function periods(kind: PeriodKind, today: Dayjs = dayjs()): Array<Period> {
  const first = kind === 'month' ? today.startOf('month') : quarterStart(today);
  const step = kind === 'month' ? 1 : 3;
  return Array.from({ length: choices[kind] }, (_, i) => {
    const start = first.subtract(i * step, 'month');
    const end = start.add(step, 'month').subtract(1, 'day');
    const label =
      kind === 'month' ? start.format('MMM YYYY') : `Q${Math.floor(start.month() / 3) + 1} ${start.format('YYYY')}`;
    return { key: start.format('YYYY-MM-DD'), start, end, label };
  });
}
