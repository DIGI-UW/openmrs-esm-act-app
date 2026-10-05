import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  AddIcon,
  CardHeader,
  EmptyCard,
  ErrorState,
  formatDate,
  isDesktop,
  useConfig,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { PRIVILEGE_ADD_ENCOUNTERS } from '../constants';
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import {
  type Echocardiogram,
  type Electrocardiogram,
  useEchocardiograms,
  useElectrocardiograms,
} from './echocardiograms.resource';
import styles from './cardiac-tests.scss';

const coded = (value: unknown) => (value as { display?: string } | undefined)?.display ?? '--';

function Echocardiograms({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { cardiacTests } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const { echocardiograms, error, isLoading } = useEchocardiograms(patientUuid);
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const { user } = useSession();
  const mayAdd = Boolean(user) && userHasAccess(PRIVILEGE_ADD_ENCOUNTERS, user);
  const columns: Array<{ header: string; text: (echo: Echocardiogram) => string }> = [
    { header: t('date', 'Date'), text: (echo) => formatDate(echo.date, { time: false }) },
    { header: t('mitralRegurgitation', 'Mitral regurgitation'), text: (echo) => coded(echo.mitralRegurgitation) },
    { header: t('mitralStenosis', 'Mitral stenosis'), text: (echo) => coded(echo.mitralStenosis) },
    { header: t('aorticRegurgitation', 'Aortic regurgitation'), text: (echo) => coded(echo.aorticRegurgitation) },
    { header: t('aorticStenosis', 'Aortic stenosis'), text: (echo) => coded(echo.aorticStenosis) },
    {
      header: t('leftVentricularEjectionFraction', 'Left ventricular ejection fraction'),
      text: (echo) => (echo.ejectionFraction == null ? '--' : `${echo.ejectionFraction}%`),
    },
  ];

  const add = () => openForm(cardiacTests.echoForm);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (error) {
    return <ErrorState error={error} headerTitle={t('echocardiograms', 'Echocardiograms')} />;
  }
  if (!isLoading && !echocardiograms.length) {
    return (
      <EmptyCard
        displayText={t('echocardiogramsLowercase', 'echocardiograms')}
        headerTitle={t('echocardiograms', 'Echocardiograms')}
        launchForm={mayAdd ? add : undefined}
      />
    );
  }
  return (
    <div className={styles.card}>
      <CardHeader title={t('echocardiograms', 'Echocardiograms')}>
        {mayAdd && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={isOpening}
            onClick={add}
          >
            {t('add', 'Add')}
          </Button>
        )}
      </CardHeader>
      {isLoading ? (
        <DataTableSkeleton
          role="progressbar"
          columnCount={columns.length}
          compact={desktop}
          showHeader={false}
          showToolbar={false}
        />
      ) : (
        <div className={styles.tableContainer}>
          <Table size={desktop ? 'sm' : 'lg'}>
            <TableHead>
              <TableRow>
                <TableExpandHeader aria-label={t('otherFindings', 'Other findings')} />
                {columns.map((column) => (
                  <TableHeader key={column.header}>{column.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {echocardiograms.map((echo) => (
                <React.Fragment key={echo.uuid}>
                  <TableExpandRow
                    aria-label={t('otherFindings', 'Other findings')}
                    isExpanded={expanded === echo.uuid}
                    onExpand={() => setExpanded(expanded === echo.uuid ? null : echo.uuid)}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.header}>{column.text(echo)}</TableCell>
                    ))}
                  </TableExpandRow>
                  {expanded === echo.uuid && (
                    <TableExpandedRow colSpan={columns.length + 1}>
                      {echo.otherFindings.length ? (
                        <dl className={styles.findings} data-testid="other-findings">
                          {echo.otherFindings.map((finding) => (
                            <div key={finding.question}>
                              <dt className={styles.findingLabel}>{finding.question}</dt>
                              <dd>{finding.answer}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p data-testid="other-findings">{t('noOtherFindings', 'No other findings recorded')}</p>
                      )}
                    </TableExpandedRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Electrocardiograms({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { cardiacTests } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const { electrocardiograms, error, isLoading } = useElectrocardiograms(patientUuid);
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const { user } = useSession();
  const mayAdd = Boolean(user) && userHasAccess(PRIVILEGE_ADD_ENCOUNTERS, user);
  const title = t('electrocardiograms', 'Electrocardiograms');
  const columns: Array<{ header: string; text: (ecg: Electrocardiogram) => string }> = [
    { header: t('date', 'Date'), text: (ecg) => formatDate(ecg.date, { time: false }) },
    { header: t('result', 'Result'), text: (ecg) => ecg.results.join(', ') || '--' },
    { header: t('otherFinding', 'Other finding'), text: (ecg) => ecg.otherFinding ?? '--' },
  ];
  const add = () => openForm(cardiacTests.ecgForm);

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !electrocardiograms.length) {
    return (
      <EmptyCard
        displayText={t('electrocardiogramsLowercase', 'electrocardiograms')}
        headerTitle={title}
        launchForm={mayAdd ? add : undefined}
      />
    );
  }
  return (
    <div className={styles.card}>
      <CardHeader title={title}>
        {mayAdd && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={isOpening}
            onClick={add}
          >
            {t('add', 'Add')}
          </Button>
        )}
      </CardHeader>
      {isLoading ? (
        <DataTableSkeleton
          role="progressbar"
          columnCount={columns.length}
          compact={desktop}
          showHeader={false}
          showToolbar={false}
        />
      ) : (
        <div className={styles.tableContainer}>
          <Table size={desktop ? 'sm' : 'lg'} aria-label={title}>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeader key={column.header}>{column.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {electrocardiograms.map((ecg) => (
                <TableRow key={ecg.uuid}>
                  {columns.map((column) => (
                    <TableCell key={column.header}>{column.text(ecg)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function CardiacTests({ patientUuid }: { patientUuid: string }) {
  return (
    <div className={styles.cards}>
      <Echocardiograms patientUuid={patientUuid} />
      <Electrocardiograms patientUuid={patientUuid} />
    </div>
  );
}
