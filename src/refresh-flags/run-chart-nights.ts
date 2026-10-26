import dayjs from 'dayjs';
import { type RunChartRun } from './run-chart-snapshot.resource';

export interface Night {
  /** YYYY-MM-DD. */
  date: string;
  /** The night's latest run, or null when nothing was recorded for it. */
  run: RunChartRun | null;
}

export const NIGHTS = 7;

/**
 * The last nights up to today, newest first, each with its latest run: a night on which nothing ran at all is
 * listed too, since that is how a missing week goes unnoticed.
 */
export function nightsOf(runs: Array<RunChartRun>, today: Date = new Date(), count = NIGHTS): Array<Night> {
  return Array.from({ length: count }, (_, back) => {
    const date = dayjs(today).subtract(back, 'day').format('YYYY-MM-DD');
    const ofTheNight = runs.filter((run) => run.runDate === date);
    const run = ofTheNight.reduce<RunChartRun | null>(
      (latest, candidate) => (!latest || candidate.finished > latest.finished ? candidate : latest),
      null,
    );
    return { date, run };
  });
}
