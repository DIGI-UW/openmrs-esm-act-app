# OpenMRS ACT frontend module

[![OpenMRS CI](https://github.com/DIGI-UW/openmrs-esm-act-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DIGI-UW/openmrs-esm-act-app/actions/workflows/ci.yml)

The screens of ACT 3.0, the OpenMRS 3 edition of the ACT rheumatic heart disease (RHD) registry.
Published to npm as `@act-registry/esm-act-app`.

## What it adds

| Area | Screens |
| --- | --- |
| Home pages | ACT home, Home (community clinicians and data clerks), Instance admin |
| Patient lists | Registry, Worklists, Procedural waiting list, Screen positive, Due for prophylaxis |
| Data entry | Enter prophylaxis, Scan patient card, Screening counts |
| Reports | Dashboard, Run charts, Reports, Facility reports, Download data |
| Administration | Users and roles, Clinics, Role permissions, Studies, Flags and adherence, Logs |
| Patient chart | Pages, summary cards, banner tags and workspaces for RHD care |
| Every page | Session timeout warning, help menu links |

## Who sees what

Each screen is gated by a privilege in [`src/routes.json`](src/routes.json), mostly ACT app privileges
such as `App: act.registry` or `App: act.dataClerk`. The distro's roles decide which of these each user
holds, so menus and quick actions follow the user's role.

## Requirements

| | |
| --- | --- |
| Backend modules | webservices.rest 2.40.0+, [ACT Core](https://github.com/DIGI-UW/openmrs-module-actcore), cohort 3.7.3+, reportingrest 2.0.0+, patientflags 3.0.10+ |
| Frontend apps | home, patient chart, forms and patient flags |

## Adding it to a distro

List it in `frontend/spa-assemble-config.json`, taking `next` for the newest prerelease or a release version:

```json
"frontendModules": {
  "@act-registry/esm-act-app": "next"
}
```

Then, in the distro's frontend config:

- **Land users on their home**: map each role to `act-home` or `act-community-home` in the home app's
  `defaultDashboardPerRole`, and send the login app's `loginSuccess` to `/home`.
- **Add chart pages** to `patient-chart-dashboard-slot`, for example `act-prophylaxis-dashboard-link`.
- **Change quick actions** through each home's slot (`act-home-quick-actions-slot`,
  `act-community-home-quick-actions-slot`).

## Configuration

Everything else (forms, encounter types, concepts, reports, urgency bands, session timeout and so on) is
set under `@act-registry/esm-act-app` in the frontend config. Each option and its default is described in
[`src/config-schema.ts`](src/config-schema.ts).

## Development

```sh
yarn          # install
yarn start    # run against a backend: openmrs develop --backend <url>
yarn verify   # lint, typecheck and tests
yarn build    # build to dist/
```

On Node 25 or later, run the tests with `NODE_OPTIONS=--no-experimental-webstorage`.
