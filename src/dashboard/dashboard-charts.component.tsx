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
// A colour means one thing on every chart, so a label the reports send keeps its colour wherever it is drawn.
const labelColours: Record<string, string> = {
  Active: teal,
  'Rheumatic Heart Disease/Rheumatic Fever': teal,
  'Lost to follow-up': '#ee538b',
  Deceased: '#393939',
  'Voluntary inactivity': '#8a3800',
  'Physical relocation': '#5e2900',
  Normal: '#42be65',
  'Confirmatory echo normal': '#42be65',
  'CHD spontaneous resolution': '#6fdc8c',
  'Congenital heart disease': '#a56eff',
  'Other heart disease': '#b28600',
  Other: '#b28600',
  School: '#0f62fe',
  Community: '#33b1ff',
  'Health facility': '#82cfff',
  'Not recorded': notRecorded,
  'No status recorded': notRecorded,
};
// For a label not named above, in order: none of these is a named label's colour.
const spareColours = ['#9f1853', '#002d9c', '#6929c4', '#005d5d', '#a2191f'];
// 1: emergent, 2: urgent and 3: elective, by the number an urgency starts with.
const urgencyColours = ['#da1e28', '#ff832b', '#f1c21b'];
const doneColours = [teal, '#e0e0e0'];
const unnumberedColours = ['#8d8d8d', '#525252', notRecorded];

const scaleOf = (labels: Array<string>, colours: Array<string>) =>
  Object.fromEntries(labels.map((label, index) => [label, colours[index % colours.length]]));

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
    ...base(name, '14rem'),
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
}: {
  name: string;
  steps: Array<Count>;
  testId: string;
  shareOf?: Record<string, string>;
  figureOf?: (label: string) => Figure;
}) {
  const { t } = useTranslation();
  // Translate only what is shown: figureOf and shareOf match the label as configured or reported.
  const data = useStable(steps.map(({ label, value }) => ({ group: t(label), value })));
  const options = useStable({
    ...base(name, '16rem'),
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
    <>
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
    </>
  );
}

export function StackedBars({
  name,
  data,
  groups,
  horizontal,
  colours,
  height,
}: {
  name: string;
  data: Array<{ group: string; key: string; value: number }>;
  groups: Array<string>;
  horizontal?: boolean;
  colours: 'urgency' | 'doneNotDone';
  height: string;
}) {
  // Full names on a phone leave the bars no room; the list under the chart names each in full.
  const phone = useLayoutType() === 'phone';
  const keys = { mapsTo: 'key', scaleType: ScaleTypes.LABELS, ...(!phone && { truncation: whole }) };
  const values = { mapsTo: 'value', stacked: true };
  const numbered = (group: string) => urgencyColours[parseInt(group, 10) - 1];
  const scale =
    colours === 'urgency'
      ? {
          ...scaleOf(
            groups.filter((group) => !numbered(group)),
            unnumberedColours,
          ),
          ...Object.fromEntries(groups.filter(numbered).map((group) => [group, numbered(group)])),
        }
      : scaleOf(groups, doneColours);
  const stableData = useStable(data);
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
