import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { dataClerkDashboardMeta } from './data-clerk.meta';

export default function DataClerkDashboardLink() {
  return <ActDashboardLink screen="dataClerk" meta={dataClerkDashboardMeta} />;
}
