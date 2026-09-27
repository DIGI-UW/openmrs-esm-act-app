# OpenMRS RHD frontend module

RHD-specific screens for ACT 3.0, the OpenMRS 3 edition of the ACT rheumatic heart disease registry.

## Missing data behind a flag

A critical data flag says a patient is missing something, such as "Perfusion Issues missing on
Procedures and Outcomes". This module adds a workspace, `rhd-flag-gaps-workspace`, that lists
what is missing behind a clicked flag, one row per form and field, with the form's date and the days
since. **Open form** opens that encounter in the patient chart's form entry workspace, ready to
complete.

The rows come from the [rhdflags](https://github.com/mherman22/openmrs-module-rhd-flags) module's
gap look-up, `GET /ws/rest/v1/rhdflags/gap?patient=<uuid>&flag=<uuid>`, which needs a gap query
configured for the flag. A flag without one shows "This flag does not list its missing data."

The workspace opens in the patient chart's Clinical forms window, so it needs the patient chart and
forms apps. It is launched by a flag or tag action in the patient flags app, which passes the
clicked flag as the workspace's props (`patientUuid`, `patientFlagUuid`, `flagUuid`,
`flagName`):

```json
"@openmrs/esm-patient-flags-app": {
  "tagActions": [{ "tagName": "Critical data", "workspace": "rhd-flag-gaps-workspace" }]
}
```

## Requirements

- Backend: webservices.rest 2.40.0 or later, and rhdflags with the gap look-up.
- Frontend: the patient chart, forms and patient flags apps, with the flags app passing the
  clicked flag to its workspace
  ([mherman22/openmrs-esm-patient-chart#1](https://github.com/mherman22/openmrs-esm-patient-chart/pull/1)).

## Running this code

```sh
yarn        # install dependencies
yarn start  # serve it against a backend: openmrs develop --backend <url>
```

`yarn verify` runs lint, typecheck and the tests; `yarn build` produces `dist/`.

On Node 25 or later, run the tests with `NODE_OPTIONS=--no-experimental-webstorage`: Node's own
`localStorage` otherwise replaces the test DOM's.
