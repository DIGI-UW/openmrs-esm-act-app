import React, { useContext, useRef, useState } from 'react';
import { Link } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { DonutChart, ScaleTypes, SimpleBarChart, TruncationTypes } from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
import { type Count, cascadeShares, share } from './dashboard-counts';
import { type Figure, FigureLinks } from './dashboard-figure';
import styles from './dashboard.scss';

// Each chart is given its colours as a scale, so a printed legend's swatch can show the same colour.
export const teal = '#009d9a';
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
  'Acute rheumatic fever': '#08bdba',
  'RHD A': teal,
  'RHD B': rhd,
  'RHD C/RHD D': '#005d5d',
  'RHD, details not recorded': '#9ef0f0',
  'Congenital heart disease': '#8a3ffc',
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
/** Done, then not done: the light one still shows on white. */
export const doneColours = [teal, '#d0e2ff'];
const unnumberedColours = ['#8d8d8d', '#525252', notRecorded];

const scaleOf = (labels: Array<string>, colours: Array<string>) =>
  Object.fromEntries(labels.map((label, index) => [label, colours[index % colours.length]]));

/** A label's own colour, where it has one, for a list of bars to colour as the charts do. */
export const labelColour = (label: string): string | undefined => labelColours[label];

/** Each count's colour by its label, keyed by the name shown, as Carbon matches a colour to the group it draws. */
export const labelScaleOf = (counts: Array<Count>, nameOf: (count: Count) => string) => {
  const unnamed = counts.filter(({ label }) => !labelColours[label]);
  return Object.fromEntries(
    counts.map((count) => [
      nameOf(count),
      labelColours[count.label] ?? spareColours[unnamed.indexOf(count) % spareColours.length],
    ]),
  );
};

/**
 * What a count reads as in the viewer's language. The reports send their values in English, so a value the Dashboard
 * names is translated, and any other, such as a concept's name, is shown as it is.
 */
export function useCountName() {
  const { t } = useTranslation();
  const names: Record<string, string> = {
    Active: t('active', 'Active'),
    'Lost to follow-up': t('lostToFollowUp', 'Lost to follow-up'),
    'Voluntary inactivity': t('voluntaryInactivity', 'Voluntary inactivity'),
    'Physical relocation': t('physicalRelocation', 'Physical relocation'),
    Deceased: t('deceased', 'Deceased'),
    'No status recorded': t('noStatusRecorded', 'No status recorded'),
    'No diagnosis yet': t('noDiagnosisYet', 'No diagnosis yet'),
    'RHD, details not recorded': t('rhdDetailsNotRecorded', 'RHD, details not recorded'),
    'Acute rheumatic fever': t('acuteRheumaticFever', 'Acute rheumatic fever'),
    'Congenital heart disease': t('congenitalHeartDisease', 'Congenital heart disease'),
    'Other heart disease': t('otherHeartDisease', 'Other heart disease'),
    Normal: t('normal', 'Normal'),
    Female: t('female', 'Female'),
    Male: t('male', 'Male'),
    Other: t('other', 'Other'),
    'Not recorded': t('notRecorded', 'Not recorded'),
    'Age unknown': t('ageUnknown', 'Age unknown'),
    School: t('school', 'School'),
    Community: t('community', 'Community'),
    'Health facility': t('healthFacility', 'Health facility'),
    Yes: t('yes', 'Yes'),
    No: t('no', 'No'),
  };
  return (count: Count) => count.name ?? names[count.label] ?? count.label;
}

/**
 * Each urgency's colour: 1: emergent, 2: urgent and 3: elective by the number it starts with, darker for sooner, and an
 * urgency with no number in greys.
 */
export function urgencyScale(urgencies: Array<string>): Record<string, string> {
  const numbered = (urgency: string) => urgencyColours[parseInt(urgency, 10) - 1];
  // The form's own urgencies read "2: urgent", so another starting with 2 takes the darker shade.
  const numberedColour = (urgency: string) => {
    const number = parseInt(urgency, 10);
    const shared = urgencies.some((other) => other !== urgency && parseInt(other, 10) === number);
    return (shared && !/^\d+:/.test(urgency) ? urgencyColoursAgain : urgencyColours)[number - 1];
  };
  return {
    ...scaleOf(
      urgencies.filter((urgency) => !numbered(urgency)),
      unnumberedColours,
    ),
    ...Object.fromEntries(urgencies.filter(numbered).map((urgency) => [urgency, numberedColour(urgency)])),
  };
}

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

/**
 * Which of a chart's groups it draws, as Carbon's own legend chooses: a click on a group draws it alone, a click on
 * another adds or removes that one, and a click on the only one drawn draws them all again.
 */
export function useShownGroups(groups: Array<string>) {
  const [chosen, setChosen] = useState<Array<string>>([]);
  // A group the counts no longer have, after a clinic or a date changes, is no longer chosen.
  const present = chosen.filter((group) => groups.includes(group));
  const isShown = (group: string) => !present.length || present.includes(group);
  const toggle = (group: string) => {
    if (!present.length) {
      setChosen([group]);
    } else if (present.length === 1 && present[0] === group) {
      setChosen([]);
    } else {
      setChosen(present.includes(group) ? present.filter((other) => other !== group) : [...present, group]);
    }
  };
  return { isShown, toggle };
}

/** A group's colour and name in a legend, drawing or leaving out the group on its chart when clicked. */
export function LegendToggle({
  label,
  colour,
  shown,
  onToggle,
  className,
}: {
  label: React.ReactNode;
  colour: string;
  shown: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.legendToggle} ${shown ? '' : styles.leftOut} ${className ?? ''}`}
      aria-pressed={shown}
      onClick={onToggle}
    >
      <span className={styles.swatch} style={shown ? { backgroundColor: colour } : undefined} aria-hidden="true" />
      <span>{label}</span>
    </button>
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
  const nameOf = useCountName();
  const { isShown, toggle } = useShownGroups(counts.map(({ label }) => label));
  const scale = labelScaleOf(counts, nameOf);
  const total = counts.reduce((sum, { value }) => sum + value, 0);
  const data = useStable(
    counts.filter(({ label }) => isShown(label)).map((count) => ({ group: nameOf(count), value: count.value })),
  );
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
        {counts.map((count) => (
          <li key={count.label} className={styles.legendRow} data-testid={testId}>
            <LegendToggle
              label={nameOf(count)}
              colour={scale[nameOf(count)]}
              shown={isShown(count.label)}
              onToggle={() => toggle(count.label)}
            />
            <span className={styles.count}>
              <CountLink value={count.value} figure={figureOf?.(count.label)} />
            </span>
            {withShare && <span className={styles.share}>{share(count.value, total)}%</span>}
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
  const { isShown, toggle } = useShownGroups(steps.map(({ label }) => label));
  // Translate only what is shown: figureOf and shareOf match the label as configured or reported.
  const data = useStable(
    steps.filter(({ label }) => isShown(label)).map(({ label, value }) => ({ group: t(label), value })),
  );
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
            <LegendToggle
              label={t(step.label)}
              colour={teal}
              shown={isShown(step.label)}
              onToggle={() => toggle(step.label)}
            />
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

export interface SegmentedRow {
  key: string;
  label: string;
  /** One value per segment, in the segments' order. */
  values: Array<number>;
  /** The row's numbers, after its bar. */
  end: React.ReactNode;
}

/**
 * Rows of bars split into coloured segments, under a key to the colours whose items draw or leave out a segment. A
 * whole row's segments are shares of the full length, drawn or not; otherwise a row's length is its share of the largest.
 */
export function SegmentedBars({
  name,
  segments,
  rows,
  whole,
  testId,
}: {
  name: string;
  segments: Array<{ label: string; colour: string }>;
  rows: Array<SegmentedRow>;
  whole?: boolean;
  testId: string;
}) {
  const { isShown, toggle } = useShownGroups(segments.map(({ label }) => label));
  const wholes = rows.map((row) => row.values.reduce((sum, value) => sum + value, 0));
  const totals = rows.map((row) =>
    row.values.reduce((sum, value, index) => sum + (isShown(segments[index].label) ? value : 0), 0),
  );
  const largest = Math.max(0, ...totals);
  return (
    <div className={styles.segmented}>
      <ul className={styles.key} aria-label={name}>
        {segments.map((segment) => (
          <li key={segment.label}>
            <LegendToggle
              label={segment.label}
              colour={segment.colour}
              shown={isShown(segment.label)}
              onToggle={() => toggle(segment.label)}
            />
          </li>
        ))}
      </ul>
      <ul className={styles.segmentRows}>
        {rows.map((row, rowIndex) => (
          <li key={row.key} className={styles.segmentRow} data-testid={testId}>
            <span className={styles.segmentLabel}>{row.label}</span>
            <span className={styles.segmentTrack}>
              <span
                className={styles.segmentFill}
                data-testid="dashboard-segment-fill"
                style={{ width: `${share(totals[rowIndex], whole ? wholes[rowIndex] : largest)}%` }}
              >
                {row.values.map((value, index) =>
                  value && isShown(segments[index].label) ? (
                    <span
                      key={segments[index].label}
                      className={styles.segment}
                      title={`${segments[index].label}: ${value}`}
                      data-testid="dashboard-segment"
                      style={{ flexGrow: value, backgroundColor: segments[index].colour }}
                      aria-hidden="true"
                    />
                  ) : null,
                )}
              </span>
            </span>
            <span className={styles.segmentEnd}>{row.end}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
