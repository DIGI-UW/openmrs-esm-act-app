import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { PatientDocumentsPictogram, userHasAccess, useSession } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import {
  PRIVILEGE_VIEW_AUDIT_LOGS,
  PRIVILEGE_VIEW_READ_AUDIT_LOGS,
  PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS,
} from '../constants';
import { useUrlFilters } from '../table-filters/url-filters';
import { ActivityTab } from './activity-tab.component';
import { DownloadsTab } from './downloads-tab.component';
import { logFilterKeys } from './log-filters.component';
import { ReadsTab } from './reads-tab.component';
import { SignInsTab } from './sign-ins-tab.component';
import styles from './logs.scss';

export type LogTabKey = 'activity' | 'reads' | 'downloads' | 'signIns';

/** Each tab's privilege, as its source requires it: the audit module's for changes, reads and security events. */
export const logTabPrivileges: Record<LogTabKey, string> = {
  activity: PRIVILEGE_VIEW_AUDIT_LOGS,
  reads: PRIVILEGE_VIEW_READ_AUDIT_LOGS,
  downloads: PRIVILEGE_VIEW_READ_AUDIT_LOGS,
  signIns: PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS,
};

const tabOrder: Array<LogTabKey> = ['activity', 'reads', 'downloads', 'signIns'];

/**
 * ACT's Logs: one page in ACT 2.0's Time, Action, Target format with a User column, as four tabs over the sources
 * (ACT Core's grouping of the audit module's revisions and reads, its download log, and the audit module's
 * security log), each shown only to a user holding its privilege.
 */
export default function Logs() {
  const { t } = useTranslation();
  const { user } = useSession();
  const [filters, setFilters] = useUrlFilters(logFilterKeys);
  const tabs = tabOrder.filter((tab) => user && userHasAccess(logTabPrivileges[tab], user));
  const selected = Math.max(0, tabs.indexOf(filters.tab as LogTabKey));

  const panels: Record<LogTabKey, { label: string; hint?: string; content: React.ReactNode }> = {
    activity: {
      label: t('activity', 'Activity'),
      hint: t('whatUsersChanged', 'what users changed'),
      content: <ActivityTab filters={filters} onFilters={setFilters} />,
    },
    reads: {
      label: t('patientsOpened', 'Patients opened'),
      hint: t('whatUsersRead', 'what users read'),
      content: <ReadsTab filters={filters} onFilters={setFilters} />,
    },
    downloads: {
      label: t('downloads', 'Downloads'),
      hint: t('whatLeftTheSystem', 'what left the system'),
      content: <DownloadsTab filters={filters} onFilters={setFilters} />,
    },
    signIns: { label: t('signIns', 'Sign-ins'), content: <SignInsTab filters={filters} onFilters={setFilters} /> },
  };

  if (!tabs.length) {
    return null;
  }
  return (
    <>
      <ActPageHeader title={t('logs', 'Logs')} illustration={<PatientDocumentsPictogram />} />
      <div className={styles.page}>
        <Tabs selectedIndex={selected} onChange={({ selectedIndex }) => setFilters({ tab: tabs[selectedIndex] })}>
          <TabList aria-label={t('logs', 'Logs')}>
            {tabs.map((tab) => (
              <Tab key={tab}>
                {panels[tab].label}
                {panels[tab].hint && <span className={styles.tabHint}>{panels[tab].hint}</span>}
              </Tab>
            ))}
          </TabList>
          <TabPanels>
            {tabs.map((tab, index) => (
              <TabPanel key={tab}>{index === selected && panels[tab].content}</TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </div>
    </>
  );
}
