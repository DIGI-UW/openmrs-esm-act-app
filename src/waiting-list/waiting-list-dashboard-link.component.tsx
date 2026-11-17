import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { useHoldsWorklists } from '../access/holds-worklists';
import { waitingListDashboardMeta } from './waiting-list.meta';

/** The waiting list's entry in the left nav, left out for a user with the worklists, whose tile opens it. */
export default function WaitingListDashboardLink() {
  const holdsWorklists = useHoldsWorklists();
  if (holdsWorklists) {
    return null;
  }
  return <ActDashboardLink meta={waitingListDashboardMeta} />;
}
