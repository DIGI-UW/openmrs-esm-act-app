import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, Tile } from '@carbon/react';
import { ExtensionSlot, useAssignedExtensions, useSession } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import actLogo from '../assets/act-logo.png';
import { actHomeWidgetsSlot } from './act-home.meta';
import styles from './act-home.scss';

const actRolePrefix = 'Organizational: ACT ';

/** The signed-in user's ACT roles, as the role names without their prefix; none of the server's own roles. */
function SignedInRole() {
  const { t } = useTranslation();
  const { user } = useSession();
  const roles = (user?.roles ?? [])
    .map((role) => role.display)
    .filter((display) => display.startsWith(actRolePrefix))
    .map((display) => display.slice(actRolePrefix.length));
  return roles.length ? (
    <span className={styles.role}>{t('signedInRole', 'Role: {{roles}}', { roles: roles.join(', ') })}</span>
  ) : null;
}

/** A home page: its header, then the widgets assigned to its slot, or a message while there are none. */
export function HomeDashboard({
  title,
  widgetsSlot,
  emptyMessage,
}: {
  title: string;
  widgetsSlot: string;
  emptyMessage: string;
}) {
  const { t } = useTranslation();
  const widgets = useAssignedExtensions(widgetsSlot);

  return (
    <>
      <ActPageHeader
        title={title}
        illustration={<img src={actLogo} alt={t('actLogo', 'ACT logo')} className={styles.logo} />}
        actions={<SignedInRole />}
      />
      <div className={styles.dashboard}>
        {widgets.length ? (
          <ExtensionSlot name={widgetsSlot} className={styles.widgets} />
        ) : (
          <Layer>
            <Tile className={styles.message}>{emptyMessage}</Tile>
          </Layer>
        )}
      </div>
    </>
  );
}

export default function ActHomeDashboard() {
  const { t } = useTranslation();

  return (
    <HomeDashboard
      title={t('actHome', 'ACT home')}
      widgetsSlot={actHomeWidgetsSlot}
      emptyMessage={t('noActHomeWidgets', 'No widgets have been added to ACT home yet.')}
    />
  );
}
