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

- Backend: webservices.rest 2.40.0 or later, and rhdflags with the gap look-up.
- Frontend: the patient chart, forms and patient flags apps.

## Running this code

```sh
yarn        # install dependencies
yarn start  # serve it against a backend: openmrs develop --backend <url>
```

`yarn verify` runs lint, typecheck and the tests; `yarn build` produces `dist/`.

On Node 25 or later, run the tests with `NODE_OPTIONS=--no-experimental-webstorage`: Node's own
`localStorage` otherwise replaces the test DOM's.

## Adding it to a distro

The module is published to npm as `@mherman22/esm-rhd-app`. A distro lists it in
`frontend/spa-assemble-config.json`, taking `next` for the newest prerelease or a release version:

```json
"frontendModules": {
  "@mherman22/esm-rhd-app": "next"
}
```

## Releasing

CI publishes with the `NPM_AUTH_TOKEN` repository secret, an npm token that can publish to the
`@mherman22` scope.

- Every push to main publishes a prerelease, such as `1.0.1-pre.42`, under the `next` tag.
- Publishing a GitHub release publishes the version in `package.json` under `latest`, or under `next`
  when the release is marked as a pre-release. Promoting a pre-release to a full release later
  publishes nothing, so give the stable release its own version. Commit the version bump to main
  first, as a direct push or squash merge, with a commit message starting `(chore) Release` so it
  does not also publish a prerelease. Then publish the release with its tag.
