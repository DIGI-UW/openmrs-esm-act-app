import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionMenuButton2, ChartLineIcon, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useInrReviews } from './inr.resource';

/** It starts no visit, as the trend changes nothing. */
export default function InrTrendActionButton({ groupProps: { patientUuid } }: { groupProps: { patientUuid: string } }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const mayRead = Boolean(user) && userHasAccess(['Get Encounters', 'Get Observations'], user);
  const { reviews, onWarfarin, isLoading } = useInrReviews(mayRead ? patientUuid : null);
  if (isLoading || !mayRead || (!onWarfarin && !reviews.some((review) => review.inr !== null))) {
    return null;
  }
  return (
    <ActionMenuButton2
      icon={(props: ComponentProps<typeof ChartLineIcon>) => <ChartLineIcon {...props} />}
      label={t('inrTrend', 'INR trend')}
      workspaceToLaunch={{ workspaceName: 'act-inr-trend-workspace', workspaceProps: {} }}
    />
  );
}
