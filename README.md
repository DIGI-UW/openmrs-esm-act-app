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

## Quick actions

Each home has a Quick actions card that draws whatever extensions are in its slot: `act-home-quick-actions-slot`
on ACT home, `act-community-home-quick-actions-slot` on Home. Every action is one shared component, a tile with an
icon, a label and a subtitle, registered in `routes.json` once per home it belongs on, with the privilege its action
needs. So what each user sees follows their privileges, and a distro plugs actions into a home in its frontend
config, the O3 way, without code:

```json
"@mherman22/esm-act-app": {
  "extensionSlots": {
    "act-home-quick-actions-slot": { "add": ["act-community-home-record-bpg"], "order": ["act-home-register-patient"] }
  }
}
```

The actions: Register patient, Enter prophylaxis (BPG or oral), Record BPG injection, Record oral prophylaxis, Find a
patient and Facility report. Register patient, Enter prophylaxis and Find a patient read `quickActions`, so a change
there changes every home; Facility report reads `dataClerkQuickActions`.

## Home

The community clinician's and data clerk's home, at `/home/act-community-home` behind `App: act.communityHome`:
the session location and today's date, then Quick actions and Due for prophylaxis in
`act-community-home-widgets-slot`. Its quick actions (see Quick actions) are Record BPG injection, Record oral
prophylaxis, Register patient, Find a patient and, with `App: act.dataClerk`, Facility report. To land these roles on it, map
them to `act-community-home` in `defaultDashboardPerRole`, and send `loginSuccess` to `/home`, the only route on
which the home app reads that map.

## ACT home

An ACT home dashboard in the home app's left nav, at `/home/act-home`. Its widgets go in
`rhd-home-widgets-slot`; until one is added it says so. To make it the page its users land on, set the home
app's `defaultDashboardPerRole` in the distro's frontend config, for each ACT role that lands there (the clinician
and the administrators; community clinicians and data clerks land on Home), and send the login app's
`loginSuccess` to `/home`, the only route on which the home app reads that map:

```json
"@openmrs/esm-home-app": {
  "defaultDashboardPerRole": { "<ACT role>": "act-home" }
}
```

Its quick actions (see Quick actions) are Register patient, Enter prophylaxis and Find a patient.
Enter prophylaxis opens ACT's patient search, which asks BPG or oral and opens the form in the chart. With
`quickActions.enterProphylaxisInFastDataEntry`, it offers the choices in `quickActions.prophylaxisForms`, as ACT 2.0 offered BPG and oral
prophylaxis: by default Enter BPG and Enter oral prophylaxis, which open the RHD BPG Delivery and RHD Oral
Adherence forms in fast data entry, where the patient is picked. Each choice has a `label` and a `url`; with
none, Enter prophylaxis links to `enterProphylaxisUrl`. Fast data entry always opens on all forms, so a
Prophylaxis category in its own config (`formCategories`) only adds a tab there.

## Procedural waiting list

A Procedural waiting list dashboard in the home app's left nav, at `/home/act-waiting-list`. It lists the rows of
the report set in `waitingList.report`, by default the distro's Procedural Waiting List: the open interventional
recommendations from each RHD Registry patient's latest consultation.

Days pending counts from the report's `date_added`. A row turns red once its days pending pass the deadline of its
urgency band, set in `urgencyBands` by the Urgency answer's concept. The defaults are ACT 2.0's three urgencies,
Emergent, Urgent and Elective, due in 1, 60 and 180 days, and the four answers they replaced, due in 7, 30, 90 and
180 days, for recommendations saved before, all in deadline order. Overdue rows come first, then the bands in the
order they are listed. The list and its Urgency filter name each band by its `label`, such as "1: Emergent (24
hours)", and ACT home's widget by its `shortLabel`, such as "1: Emergent", or its `label` without one; an answer no
band names shows the report's name for it.

Its filters are kept in the URL, and Download CSV saves the filtered rows. Open form opens that consultation for
editing in a workspace on the list itself, the forms app's `exportedPatientFormEntryWorkspace`, registered in this
app's own `act-waiting-list` workspace group as Service Queues registers it; saving it evaluates the list again.

## Patient chart pages

Pages for the patient chart's left nav, whose links are registered in no slot so that the distro chooses the chart's
pages. A distro adds a page's link to the chart's `patient-chart-dashboard-slot` in its frontend config:

```json
"@openmrs/esm-patient-chart-app": {
  "extensionSlots": {
    "patient-chart-dashboard-slot": { "add": ["act-prophylaxis-dashboard-link", "act-cardiac-tests-dashboard-link"] }
  }
}
```

- **Prophylaxis** (`act-prophylaxis-dashboard-link`): the patient's BPG injections, newest first, with the facility
  and a tag saying whether each was on time, timed by ACT Core as the Prophylaxis card's on-time count is; then their
  oral adherence entries, if any. Record BPG and Record oral open the forms set in `prophylaxisCard`. The encounter
  types and concepts are in `prophylaxisPage`.
- **Cardiac tests** (`act-cardiac-tests-dashboard-link`): the patient's echocardiograms, newest first, with the
  mitral and aortic valve findings and left ventricular ejection fraction; Add opens the echo form, starting a visit
  when the patient has none. The form, its encounter type and the concepts are in `cardiacTests`.

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
