import dayjs from 'dayjs';

/** One point of a run chart as ACT Core answers it. */
export interface RunChartPoint {
  /** The day the figure is as of, YYYY-MM-DD: the period's last day, or the range's end for the last period. */
  date: string;
  /** A total, or a percent from 0 to 100; null for a percent of none. */
  value: number | null;
  /** A count's value, or a percent's numerator. */
  count: number | null;
  /** A percent's denominator; null for a count. */
  total: number | null;
}

/** A run of points on one side of the median that a run chart reads as a real change, not chance. */
export interface Shift {
  /** The first and last point of the run, by date. */
  start: string;
  end: string;
  side: 'above' | 'below';
  length: number;
}

/** The standard run chart rule: this many points in a row on one side of the median. */
export const SHIFT_LENGTH = 6;
/** The chart needs two points to be a line. */
export const MIN_POINTS_FOR_CHART = 2;
/** A median and shifts mean something only from this many points, as the design says. */
export const MIN_POINTS_FOR_MEDIAN = 10;

/** A plain date as the local day, as a zoned midnight reads as the day before in a zone behind UTC. */
export const localDay = (date: string) => dayjs(date).startOf('day').toDate();

export const withValue = (points: Array<RunChartPoint>) => points.filter((point) => point.value !== null);

/**
 * The runs of SHIFT_LENGTH or more points on one side of the median. A point on the median, or with no value, neither
 * breaks a run nor counts in it.
 */
export function shifts(points: Array<RunChartPoint>, median: number | null): Array<Shift> {
  if (median === null) {
    return [];
  }
  const found: Array<Shift> = [];
  let run: Array<RunChartPoint> = [];
  let side: Shift['side'] | null = null;
  const close = () => {
    if (side && run.length >= SHIFT_LENGTH) {
      found.push({ start: run[0].date, end: run[run.length - 1].date, side, length: run.length });
    }
    run = [];
  };
  for (const point of withValue(points)) {
    if (point.value === median) {
      continue;
    }
    const pointSide: Shift['side'] = (point.value as number) > median ? 'above' : 'below';
    if (pointSide !== side) {
      close();
      side = pointSide;
    }
    run.push(point);
  }
  close();
  return found;
}

export interface Change {
  from: RunChartPoint;
  to: RunChartPoint;
  /** The last value less the first, to one decimal: for a percent, in percentage points. */
  difference: number;
}

/** The change from the first point with a value to the last; null with fewer than two. */
export function changeOf(points: Array<RunChartPoint>): Change | null {
  const held = withValue(points);
  if (held.length < 2) {
    return null;
  }
  const from = held[0];
  const to = held[held.length - 1];
  return { from, to, difference: Math.round(((to.value as number) - (from.value as number)) * 10) / 10 };
}
