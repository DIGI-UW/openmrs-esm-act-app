import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DonutChart, ScaleTypes, SimpleBarChart, StackedBarChart } from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
import { type Count, cascadeShares, share } from './dashboard-counts';
import styles from './dashboard.scss';

// Each chart is given its colours as a scale, so a printed legend's swatch can show the same colour.
const teal = '#005d5d';
const palette = [teal, '#ff832b', '#6929c4', '#1192e8', '#9f1853', '#b28600', '#198038', '#002d9c', '#fa4d56'];
// 1: emergent, 2: urgent and 3: elective, by the number an urgency starts with.
const urgencyColours = ['#da1e28', '#ff832b', '#f1c21b'];
const doneColours = [teal, '#a6c8ff'];
const unnumberedColours = ['#8d8d8d', '#525252', '#c6c6c6'];

const scaleOf = (labels: Array<string>, colours = palette) =>
  Object.fromEntries(labels.map((label, index) => [label, colours[index % colours.length]]));

// Carbon redraws a chart whenever its data or options is a new object.
function useStable<T>(value: T): T {
  const stable = useRef(value);
  if (JSON.stringify(stable.current) !== JSON.stringify(value)) {
    stable.current = value;
  }
  return stable.current;
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
}: {
  name: string;
  counts: Array<Count>;
  centre: string;
  testId: string;
  withShare?: boolean;
}) {
  const { t } = useTranslation();
  const scale = scaleOf(counts.map(({ label }) => label));
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
            <span className={styles.count}>{value}</span>
            {withShare && <span className={styles.share}>{share(value, total)}%</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CascadeBars({ name, steps, testId }: { name: string; steps: Array<Count>; testId: string }) {
  const data = useStable(steps.map(({ label, value }) => ({ group: label, value })));
  const options = useStable({
    ...base(name, '16rem'),
    color: {
      scale: scaleOf(
        steps.map(({ label }) => label),
        [teal],
      ),
    },
    legend: { enabled: false },
    axes: {
      left: { mapsTo: 'value' },
      bottom: { mapsTo: 'group', scaleType: ScaleTypes.LABELS },
    },
  });
  return (
    <>
      <div className={styles.chart}>
        <SimpleBarChart data={data} options={options} />
      </div>
      <ol className={styles.steps}>
        {cascadeShares(steps).map((step) => (
          <li key={step.label} className={styles.step} data-testid={testId}>
            <span>{step.label}</span>
            <span className={styles.count}>{step.value}</span>
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
  const keys = { mapsTo: 'key', scaleType: ScaleTypes.LABELS };
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
    axes: horizontal ? { left: keys, bottom: values } : { left: values, bottom: keys },
  });
  return (
    <div className={styles.chart}>
      <StackedBarChart data={stableData} options={options} />
    </div>
  );
}
