/** The home app finds this dashboard by `name` (the URL after /home/) and renders its `slot`. */
export const worklistsDashboardMeta = {
  name: 'act-worklists',
  slot: 'rhd-worklists-dashboard-slot',
  title: 'worklists',
};

/** The Worklists page, with the flag's list chosen when one is given. */
export const worklistsUrl = (flagName?: string) =>
  `\${openmrsSpaBase}/home/${worklistsDashboardMeta.name}` +
  (flagName ? `?${new URLSearchParams({ flag: flagName })}` : '');
