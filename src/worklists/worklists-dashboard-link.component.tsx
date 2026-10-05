import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { worklistsDashboardMeta } from './worklists.meta';

export default function WorklistsDashboardLink() {
  return <ActDashboardLink meta={worklistsDashboardMeta} />;
}
