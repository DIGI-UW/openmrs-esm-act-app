# OpenMRS RHD frontend module

RHD-specific screens for ACT 3.0, the OpenMRS 3 edition of the ACT rheumatic heart disease registry.

## Missing data behind a flag

A critical data flag says a patient is missing something, such as "Perfusion Issues missing on
Procedures and Outcomes". This module adds a workspace, `rhd-flag-gaps-workspace`, that lists
what is missing behind the patient's flags, one table per flag and one row per form and field, with
the form's date and the days since. **Open form** opens that encounter in the patient chart's form entry workspace, ready to
complete.

The rows come from the [rhdflags](https://github.com/mherman22/openmrs-module-rhd-flags) module's
gap look-up, `GET /ws/rest/v1/rhdflags/gap?patient=<uuid>&flag=<uuid>`, which needs a gap query
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

## Requirements

- Backend: webservices.rest 2.40.0 or later, rhdflags with the gap look-up, cohort 3.7.3 or later for the RHD flag
  lists, and reportingrest 2.0.0 or later for the report datasets.
- Frontend: the patient chart, forms and patient flags apps.

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
