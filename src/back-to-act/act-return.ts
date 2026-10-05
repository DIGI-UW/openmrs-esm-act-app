import { actHomeDashboardMeta } from '../act-home/act-home.meta';
import { registryDashboardMeta } from '../registry/registry.meta';
import { screenPositiveDashboardMeta } from '../screen-positive/screen-positive.meta';
import { waitingListDashboardMeta } from '../waiting-list/waiting-list.meta';
import { worklistsDashboardMeta } from '../worklists/worklists.meta';

const storageKey = 'act-chart-return';

/** The ACT pages a chart can be opened from, by the name after /home/ in their URL. */
export const actScreens = [
  actHomeDashboardMeta.name,
  registryDashboardMeta.name,
  worklistsDashboardMeta.name,
  waitingListDashboardMeta.name,
  screenPositiveDashboardMeta.name,
] as const;

export type ActScreenName = (typeof actScreens)[number];

const inChart = (url: URL) => /\/patient\/[^/]+\/chart/.test(url.pathname);

function actScreenOf(url: URL): ActScreenName | null {
  const name = url.pathname.match(/\/home\/([^/]+)/)?.[1];
  return actScreens.find((screen) => screen === name) ?? null;
}

export interface ActReturn {
  screen: ActScreenName;
  /** The page's path and filters when the chart was opened, without the origin. */
  path: string;
}

/** Where the chart's back link leads after a move from oldUrl to newUrl, given where it led before. */
export function nextActReturn(current: ActReturn | null, oldUrl: string, newUrl: string): ActReturn | null {
  const from = new URL(oldUrl);
  const to = new URL(newUrl);
  if (!inChart(to)) {
    return null;
  }
  if (inChart(from)) {
    return current;
  }
  const screen = actScreenOf(from);
  return screen ? { screen, path: `${from.pathname}${from.search}` } : null;
}

export function readActReturn(): ActReturn | null {
  try {
    return JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null');
  } catch {
    return null;
  }
}

function writeActReturn(value: ActReturn | null) {
  try {
    if (value) {
      window.sessionStorage.setItem(storageKey, JSON.stringify(value));
    } else {
      window.sessionStorage.removeItem(storageKey);
    }
  } catch {
    // Without session storage the chart has no back link, which is how it opens from anywhere else.
  }
}

/** Remembers the ACT page a chart was opened from, for as long as the user stays in the chart. */
export function trackActReturn() {
  window.addEventListener(
    'single-spa:before-routing-event',
    (event: CustomEvent<{ oldUrl: string; newUrl: string }>) => {
      const { oldUrl, newUrl } = event.detail ?? {};
      if (oldUrl && newUrl && oldUrl !== newUrl) {
        writeActReturn(nextActReturn(readActReturn(), oldUrl, newUrl));
      }
    },
  );
}
