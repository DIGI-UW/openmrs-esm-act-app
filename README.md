# OpenMRS ACT frontend module

RHD-specific screens for ACT 3.0, the OpenMRS 3 edition of the ACT rheumatic heart disease registry.

## Missing data behind a flag

A critical data flag says a patient is missing something, such as "Perfusion Issues missing on
Procedures and Outcomes". This module adds a workspace, `rhd-flag-gaps-workspace`, that lists
what is missing behind the patient's flags, one table per flag and one row per form and field, with
the form's date and the days since. **Open form** opens that encounter in the patient chart's form entry workspace, ready to
complete.

The rows come from the [ACT Core](https://github.com/DIGI-UW/openmrs-module-actcore) module's
gap look-up, `GET /ws/rest/v1/actcore/gap?patient=<uuid>&flag=<uuid>`, which needs a gap query
configured for the flag; a flag without one is left out. When the missing data has no saved form to go
on yet, the workspace offers Clinical forms to start one.

The workspace opens in the patient chart's Clinical forms window, so it needs the patient chart and
forms apps. It is launched by a flag or tag action in the patient flags app, and takes the patient
from the patient chart:

```json
"@openmrs/esm-patient-flags-app": {
  "tagActions": [{ "tagName": "Critical data", "workspace": "rhd-flag-gaps-workspace" }]
}
```

A flags app that passes the clicked flag as the workspace's props (`patientUuid`, `patientFlagUuid`,
`flagUuid`, `flagName`) narrows the workspace to that flag.

## ACT home

An ACT home dashboard in the home app's left nav, at `/home/act-home`. Its widgets go in
`rhd-home-widgets-slot`; until one is added it says so. To make it the page ACT users land on, set the home
app's `defaultDashboardPerRole` in the distro's frontend config, for each ACT role:

```json
"@openmrs/esm-home-app": {
  "defaultDashboardPerRole": { "<ACT role>": "act-home" }
}
```

Its quick actions open registration, Enter prophylaxis and patient search; their links are in `quickActions`.
Enter prophylaxis offers the choices in `quickActions.prophylaxisForms`, as ACT 2.0 offered BPG and oral
prophylaxis: by default Enter BPG and Enter oral prophylaxis, which open the RHD BPG Delivery and RHD Oral
Adherence forms in fast data entry, where the patient is picked. Each choice has a `label` and a `url`; with
none, Enter prophylaxis links to `enterProphylaxisUrl`. Fast data entry always opens on all forms, so a
Prophylaxis category in its own config (`formCategories`) only adds a tab there.

## Procedural waiting list

A Procedural waiting list dashboard in the home app's left nav, at `/home/act-waiting-list`. It lists the rows of
the report set in `waitingList.report`, by default the distro's Procedural Waiting List: the open interventional
recommendations from each RHD Registry patient's latest consultation.

Days pending counts from the report's `date_added`. A row turns red once its days pending pass the deadline of its
urgency band, set in `urgencyBands` by the Urgency answer's concept; the defaults are the RHD Consultation Visit's
four answers, due in 7, 30, 90 and 180 days. Overdue rows come first, then the bands in the order they are listed.

Its filters are kept in the URL, and Download CSV saves the filtered rows. Open form opens that consultation for
editing in a workspace on the list itself, the forms app's `exportedPatientFormEntryWorkspace`, registered in this
app's own `act-waiting-list` workspace group as Service Queues registers it; saving it evaluates the list again.

## Colours and branding

The ACT screens take their colours from the OpenMRS styleguide, so they follow a distribution's
branding. The distro sets it in the styleguide's config:

```json
"@openmrs/esm-styleguide": {
  "Brand color #1": "#005d5d",
  "Brand color #2": "#004144",
  "Brand color #3": "#007d79"
}
```

Use them as OpenMRS does, through the styleguide's `brand-01`, `brand-02` and `brand-03` mixins
(`@use '@openmrs/esm-styleguide/src/vars' as *;`):

- **brand-01**, the primary colour: accents such as the quick actions' icons, the care cascade's bars, and
  the top edge of the worklist tiles.
- **brand-02**, the secondary: the hover and pressed state of those accents.
- **brand-03**, the tertiary: focus rings and selected items, through the `act-focus` mixin.

Use the styleguide's neutrals for surfaces and text (`$ui-01` to `$ui-05`, `$text-02`). Status colours
stay the same whatever the brand, so a warning never takes a site's colour. They are in
`src/styles/_act-colours.scss`: `$act-risk` (the styleguide's danger red) for overdue waiting list
rows, and `$act-data-quality-background` and `$act-data-quality-text` (Carbon's orange) for missing data flag tags. A new screen uses these variables and
mixins rather than hex values or Carbon's palette directly.

## Requirements

- Backend: webservices.rest 2.40.0 or later, ACT Core with the gap look-up, cohort 3.7.3 or later for the RHD flag
  lists, and reportingrest 2.0.0 or later for the report datasets.
- Frontend: the patient chart, forms and patient flags apps; ACT home needs the home app.

## Privileges for ACT roles

The ACT screens (the home page, registry, waiting list and screen positive page, still to come) are to be shown
only to users with the privilege set for each in `screenPrivileges`, by default `View Patient Flags`, using
`ScreenAccess`. To read their data, a role also needs these privileges:

| Data | Privileges to grant |
| --- | --- |
| The RHD flag lists and their members | `Get Patient Cohorts`, `View Cohorts In Cohort Module` |
| Report datasets, such as the registry and the waiting list | `View Reports`, `Run Reports`, `Get Patients` |

`Run Reports` lets a user evaluate any report on the server.

## Running this code

```sh
yarn        # install dependencies
yarn start  # serve it against a backend: openmrs develop --backend <url>
```

`yarn verify` runs lint, typecheck and the tests; `yarn build` produces `dist/`.

On Node 25 or later, run the tests with `NODE_OPTIONS=--no-experimental-webstorage`: Node's own
`localStorage` otherwise replaces the test DOM's.

## Adding it to a distro

The module is published to npm as `@mherman22/esm-act-app`. A distro lists it in
`frontend/spa-assemble-config.json`, taking `next` for the newest prerelease or a release version:

```json
"frontendModules": {
  "@mherman22/esm-act-app": "next"
}
```

## Releasing

CI publishes with the `NPM_AUTH_TOKEN` repository secret, an npm token that can publish to the
`@mherman22` scope.

- A push to main publishes a prerelease, such as `1.0.1-pre.42`, under the `next` tag. Runs on main
  queue in push order, and a run still waiting when a newer push lands is skipped.
- Publishing a GitHub release publishes the version in `package.json` under `latest`, or under `next`
  when the release is marked as a pre-release. Promoting a pre-release to a full release later
  publishes nothing, so give the stable release its own version. Commit the version bump to main
  first, as a direct push or squash merge, with a commit message starting `(chore) Release` so it
  does not also publish a prerelease. Then publish the release with its tag.
