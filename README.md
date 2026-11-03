# OpenMRS ACT frontend module

[![OpenMRS CI](https://github.com/DIGI-UW/openmrs-esm-act-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DIGI-UW/openmrs-esm-act-app/actions/workflows/ci.yml)

The screens of ACT 3.0, the OpenMRS 3 edition of the ACT rheumatic heart disease (RHD) registry.
Published to npm as `@act-registry/esm-act-app`.

## What it adds

### Home pages

| Page | Route | For |
| --- | --- | --- |
| ACT home | `/home/act-home` | Clinicians and administrators: quick actions, due for prophylaxis, worklists, overdue consultations, care cascade |
| Home | `/home/act-community-home` | Community clinicians and data clerks: quick actions and due for prophylaxis |
| Instance admin | `/home/act-instance-admin` | Instance administrators: quick actions and KPIs |

### Registry and worklists

- **Registry**: every RHD patient, with filters, flags and BPG adherence.
- **Worklists**: due for prophylaxis, confirmatory echo, cardiology follow-up, lost to follow-up,
  post-procedural follow-up, pregnancy outcome, INR review, referred to clinician and the waiting list.
- **Procedural waiting list**: open interventional recommendations, coloured by urgency deadline.
- **Screen positive**: patients who screened positive and are waiting for a diagnosis.
- **Due for prophylaxis**, **Enter prophylaxis** and **Scan patient card** (find a patient by the barcode on their ACT card).

### Reports and data

- **Dashboard** and **Run charts**: programme indicators, by clinic and over time, with export.
- **Reports** and **Facility reports**: the report catalogue and per-facility programme reports.
- **Screening counts**: monthly screening totals entered per clinic.
- **Download data**: saved forms exported as CSV, field by field.

### Administration

Users and roles, Clinics, Role permissions, Studies, Flags and adherence (re-run the RHD flags) and Logs
(what users changed, read or downloaded).

### Patient chart

- **Pages** (the distro adds them to the chart's nav): Prophylaxis, Consultation visits, Medications,
  INR reviews, Cardiac tests and Research participation.
- **Summary cards**: consultation, prophylaxis, medications, INR and next steps (with referrals).
- **Banner tags**: anaphylaxis alert, patient status, INR status, allergies and clinical flags; the
  patient's clinics below the banner.
- **Actions and workspaces**: update patient status, vitals, the missing data behind a critical data flag
  (`rhd-flag-gaps-workspace`) and study enrolment.

### Everywhere

A session timeout warning in the top nav, and Contact and Docs links in the help menu.

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
