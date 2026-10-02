import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
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
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { type Echocardiogram, useEchocardiograms } from './echocardiograms.resource';
import styles from './cardiac-tests.scss';

const coded = (value: unknown) => (value as { display?: string } | undefined)?.display ?? '--';

export default function CardiacTests({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { cardiacTests } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const { echocardiograms, error, isLoading } = useEchocardiograms(patientUuid);
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
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

  if (error) {
    return <ErrorState error={error} headerTitle={t('echocardiograms', 'Echocardiograms')} />;
  }
  if (!isLoading && !echocardiograms.length) {
    return (
      <EmptyCard
        displayText={t('echocardiogramsLowercase', 'echocardiograms')}
        headerTitle={t('echocardiograms', 'Echocardiograms')}
        launchForm={add}
      />
    );
  }
  return (
    <div className={styles.card}>
      <CardHeader title={t('echocardiograms', 'Echocardiograms')}>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={(props) => <AddIcon size={16} {...props} />}
          disabled={isOpening}
          onClick={add}
        >
          {t('add', 'Add')}
        </Button>
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
                {columns.map((column) => (
                  <TableHeader key={column.header}>{column.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {echocardiograms.map((echo) => (
                <TableRow key={echo.uuid}>
                  {columns.map((column) => (
                    <TableCell key={column.header}>{column.text(echo)}</TableCell>
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
