import { useAssignedExtensions } from '@openmrs/esm-framework';

/**
 * Routes the Role permissions page by its `meta.name` and `meta.slot`, and renders nothing: its links are the Instance
 * admin's Role permissions, in instance-admin-nav and as a quick-action tile.
 */
export default function RolePermissionsDashboardLink() {
  return null;
}

/** Whether the home dashboard assigns this link to the user, so its links follow the page's gate. */
export function useRolePermissionsAssigned() {
  return useAssignedExtensions('homepage-dashboard-slot').some(
    ({ name }) => name === 'act-role-permissions-dashboard-link',
  );
}
