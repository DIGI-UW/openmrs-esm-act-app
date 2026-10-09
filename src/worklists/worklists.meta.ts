/** The home app finds this dashboard by `name` (the URL after /home/) and renders its `slot`. */
export const worklistsDashboardMeta = {
  name: 'act-worklists',
  slot: 'rhd-worklists-dashboard-slot',
  title: 'worklists',
};

/** Each worklist is an extension here, shown as a tile on ACT home, and as a choice and its patients on the page. */
export const worklistsSlot = 'act-worklists-slot';

/** The Worklists page, with the worklist chosen when one is given by its extension's id. */
export const worklistsUrl = (worklist?: string) =>
  `\${openmrsSpaBase}/home/${worklistsDashboardMeta.name}` +
  (worklist ? `?${new URLSearchParams({ list: worklist })}` : '');
