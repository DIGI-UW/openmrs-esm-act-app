import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { waitingListDashboardMeta } from './waiting-list.meta';

export default function WaitingListDashboardLink() {
  return <ActDashboardLink screen="waitingList" meta={waitingListDashboardMeta} />;
}
