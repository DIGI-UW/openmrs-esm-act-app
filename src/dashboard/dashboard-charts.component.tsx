import React, { useContext, useRef } from 'react';
import { Link } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useLayoutType } from '@openmrs/esm-framework';
import { DonutChart, ScaleTypes, SimpleBarChart, StackedBarChart, TruncationTypes } from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
import { type Count, cascadeShares, share } from './dashboard-counts';
import { type Figure, FigureLinks } from './dashboard-figure';
import styles from './dashboard.scss';

// Each chart is given its colours as a scale, so a printed legend's swatch can show the same colour.
const teal = '#009d9a';
const notRecorded = '#c6c6c6';
const rhd = '#007d79';
/**
 * A colour means one thing on every chart, so a label the reports send keeps its colour wherever it is drawn. Status
 * reads in care in teal and the reasons a registration ended by how much they need action; an RHD stage is darker the
 * later it is. Each colour but the light ones (not recorded, the earliest stages) has 3:1 contrast on white.
 */
const labelColours: Record<string, string> = {
  Active: teal,
  'Lost to follow-up': '#da1e28',
  'Voluntary inactivity': '#ba4e00',
  'Physical relocation': '#6f6f6f',
  Deceased: '#161616',
  'Rheumatic Heart Disease/Rheumatic Fever': rhd,
  RHD: rhd,
  'Acute rheumatic fever': '#08bdba',
  'RHD A': teal,
  'RHD B': rhd,
  'RHD C/RHD D': '#005d5d',
  'RHD, details not recorded': '#9ef0f0',
  'Congenital heart disease': '#8a3ffc',
  Congenital: '#8a3ffc',
  'Other heart disease': '#d02670',
  Other: '#d02670',
  Normal: '#198038',
  'Confirmatory echo normal': '#198038',
  'CHD spontaneous resolution': '#0e6027',
  Female: '#6929c4',
  Male: '#1192e8',
  School: '#002d9c',
  Community: '#0f62fe',
  'Health facility': '#4589ff',
  'Not recorded': notRecorded,
  'No status recorded': notRecorded,
  'No diagnosis yet': notRecorded,
};
// For a label not named above, in order: none of these is a named label's colour.
const spareColours = ['#9f1853', '#491d8b', '#003a6d', '#8e6a00', '#570408'];
// 1: emergent, 2: urgent and 3: elective, by the number an urgency starts with: darker for sooner.
const urgencyColours = ['#a2191f', '#eb6200', '#f1c21b'];
// A second urgency starting with the same number, as an old "2 - within 1 month" beside "2: urgent", in a darker shade.
const urgencyColoursAgain = ['#520408', '#8a3800', '#8e6a00'];
const doneColours = [teal, '#d0e2ff'];
const unnumberedColours = ['#8d8d8d', '#525252', notRecorded];

const scaleOf = (labels: Array<string>, colours: Array<string>) =>
  Object.fromEntries(labels.map((label, index) => [label, colours[index % colours.length]]));

/** A label's own colour, where it has one, for a list of bars to colour as the charts do. */
export const labelColour = (label: string): string | undefined => labelColours[label];

const labelScaleOf = (labels: Array<string>) => {
  const unnamed = labels.filter((label) => !labelColours[label]);
  return Object.fromEntries(
    labels.map((label) => [label, labelColours[label] ?? spareColours[unnamed.indexOf(label) % spareColours.length]]),
  );
};

// Carbon redraws a chart whenever its data or options is a new object.
function useStable<T>(value: T): T {
  const stable = useRef(value);
  if (JSON.stringify(stable.current) !== JSON.stringify(value)) {
    stable.current = value;
  }
  return stable.current;
}

// Carbon cuts a long label short by default, and names sharing a prefix then read the same.
const whole = { type: TruncationTypes.NONE };

/** A count that opens the patients behind it, when it names them; a modified click is left to the browser. */
export function CountLink({ value, figure }: { value: number | string; figure?: Figure }) {
  const links = useContext(FigureLinks);
  if (!figure || !links) {
    return <>{value}</>;
  }
  return (
    <Link
      href={links.href(figure)}
      onClick={(event) => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        links.open(figure);
      }}
    >
      {value}
    </Link>
  );
}

const base = (name: string, height: string) => ({
  accessibility: { svgAriaLabel: name },
  height,
  resizable: true,
  toolbar: { enabled: false },
});

export function CountsDonut({
  name,
  counts,
  centre,
  testId,
  withShare,
  figureOf,
}: {
  name: string;
  counts: Array<Count>;
  centre: string;
  testId: string;
  withShare?: boolean;
  figureOf?: (label: string) => Figure;
}) {
  const { t } = useTranslation();
  const scale = labelScaleOf(counts.map(({ label }) => label));
  const total = counts.reduce((sum, { value }) => sum + value, 0);
  const data = useStable(counts.map(({ label, value }) => ({ group: label, value })));
  const options = useStable({
    ...base(name, '11rem'),
    color: { scale },
    legend: { enabled: false },
    donut: { center: { label: centre }, alignment: 'center' },
    pie: { labels: { enabled: false } },
  });
  if (!total) {
    return <p className={styles.empty}>{t('noPatientsToCount', 'No patients to count')}</p>;
  }
  return (
    <div className={styles.donut}>
      <div className={styles.chart}>
        <DonutChart data={data} options={options} />
      </div>
      <ul className={styles.legend}>
        {counts.map(({ label, value }) => (
          <li key={label} className={styles.legendRow} data-testid={testId}>
            <span className={styles.swatch} style={{ backgroundColor: scale[label] }} aria-hidden="true" />
            <span>{label}</span>
            <span className={styles.count}>
              <CountLink value={value} figure={figureOf?.(label)} />
            </span>
            {withShare && <span className={styles.share}>{share(value, total)}%</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CascadeBars({
  name,
  steps,
  testId,
  shareOf,
  figureOf,
  height = '12rem',
}: {
  name: string;
  steps: Array<Count>;
  testId: string;
  shareOf?: Record<string, string>;
  figureOf?: (label: string) => Figure;
  height?: string;
}) {
  const { t } = useTranslation();
  // Translate only what is shown: figureOf and shareOf match the label as configured or reported.
  const data = useStable(steps.map(({ label, value }) => ({ group: t(label), value })));
  const options = useStable({
    ...base(name, height),
    color: {
      scale: scaleOf(
        steps.map(({ label }) => t(label)),
        [teal],
      ),
    },
    legend: { enabled: false },
    axes: {
      left: { mapsTo: 'value' },
      bottom: { mapsTo: 'group', scaleType: ScaleTypes.LABELS, truncation: whole },
    },
  });
  return (
    <div className={styles.split}>
      <div className={styles.chart}>
        <SimpleBarChart data={data} options={options} />
      </div>
      <ol className={styles.steps}>
        {cascadeShares(steps, shareOf).map((step) => (
          <li key={step.label} className={styles.step} data-testid={testId}>
            <span>{t(step.label)}</span>
            <span className={styles.count}>
              <CountLink value={step.value} figure={figureOf?.(step.label)} />
            </span>
            {step.share !== null && <span className={styles.share}>{step.share}%</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StackedBars({
  name,
  data,
  groups,
  horizontal,
  asShares,
  colours,
  height,
}: {
  name: string;
  data: Array<{ group: string; key: string; value: number }>;
  groups: Array<string>;
  horizontal?: boolean;
  asShares?: boolean;
  colours: 'urgency' | 'doneNotDone';
  height: string;
}) {
  // Full names on a phone leave the bars no room; the list under the chart names each in full.
  const phone = useLayoutType() === 'phone';
  const keys = { mapsTo: 'key', scaleType: ScaleTypes.LABELS, ...(!phone && { truncation: whole }) };
  const values = { mapsTo: 'value', stacked: true, ...(asShares && { percentage: true }) };
  const numbered = (group: string) => urgencyColours[parseInt(group, 10) - 1];
  // The form's own urgencies read "2: urgent", so another starting with 2 takes the darker shade.
  const numberedColour = (group: string) => {
    const number = parseInt(group, 10);
    const shared = groups.some((other) => other !== group && parseInt(other, 10) === number);
    return (shared && !/^\d+:/.test(group) ? urgencyColoursAgain : urgencyColours)[number - 1];
  };
  // Shares put every row on one length, so rows with different denominators compare at a glance.
  const rows = asShares
    ? data.map((entry) => {
        const whole = data.filter((other) => other.key === entry.key).reduce((sum, other) => sum + other.value, 0);
        return { ...entry, value: whole ? Math.round((entry.value / whole) * 1000) / 10 : 0 };
      })
    : data;
  const scale =
    colours === 'urgency'
      ? {
          ...scaleOf(
            groups.filter((group) => !numbered(group)),
            unnumberedColours,
          ),
          ...Object.fromEntries(groups.filter(numbered).map((group) => [group, numberedColour(group)])),
        }
      : scaleOf(groups, doneColours);
  const stableData = useStable(rows);
  const options = useStable({
    ...base(name, height),
    color: { scale },
    legend: { truncation: whole },
    axes: horizontal ? { left: keys, bottom: values } : { left: values, bottom: keys },
  });
  return (
    <div className={styles.chart}>
      <StackedBarChart data={stableData} options={options} />
    </div>
  );
}
