import dayjs from 'dayjs';
import { type RunChartRun } from './run-chart-snapshot.resource';

export interface Night {
  /** YYYY-MM-DD. */
  date: string;
  /** True for the night still in progress, whose nightly run may not be due yet. */
  today: boolean;
  /** The night's latest taken run, else its latest failed one, or null when nothing ran. */
  run: RunChartRun | null;
}

export const NIGHTS = 7;

/**
 * The last nights up to today, newest first, each with its latest taken run, else its latest failed one;
 * a night with no run is listed too, so a missing week does not go unnoticed.
 */
export function nightsOf(runs: Array<RunChartRun>, today: Date = new Date(), count = NIGHTS): Array<Night> {
  return Array.from({ length: count }, (_, back) => {
    const date = dayjs(today).subtract(back, 'day').format('YYYY-MM-DD');
    const ofTheNight = runs.filter((run) => run.runDate === date);
    const latest = (status: RunChartRun['status']) =>
      ofTheNight
        .filter((run) => run.status === status)
        .reduce<RunChartRun | null>((newest, run) => (!newest || run.finished > newest.finished ? run : newest), null);
    return { date, today: back === 0, run: latest('taken') ?? latest('failed') };
  });
}
