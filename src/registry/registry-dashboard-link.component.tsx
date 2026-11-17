import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { registryDashboardMeta } from './registry.meta';

export default function RegistryDashboardLink() {
  return <ActDashboardLink meta={registryDashboardMeta} />;
}
