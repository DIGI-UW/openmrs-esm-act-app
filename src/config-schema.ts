import { Type, validator } from '@openmrs/esm-framework';

const locationTags = (clinics: string, defaultTags: Array<string>) => ({
  _type: Type.Array,
  _elements: { _type: Type.String },
  _default: defaultTags,
  _description: `Location tags that mark ${clinics}.`,
});

const concept = (description: string, defaultUuid: string) => ({
  _type: Type.ConceptUuid,
  _default: defaultUuid,
  _description: description,
});

const link = (description: string, defaultUrl: string) => ({
  _type: Type.String,
  _default: defaultUrl,
  _description: description,
});

export const configSchema = {
  clinicLocationTags: {
    cardiac: locationTags('cardiac clinics', ['RHD Tertiary', 'RHD District']),
    primaryCare: locationTags('primary care clinics', ['RHD Community']),
  },
  clinics: {
    levels: {
      _type: Type.Array,
      _elements: {
        _type: Type.Object,
        tag: { _type: Type.String, _description: 'The location tag that gives a clinic this level.' },
        level: { _type: Type.String, _description: "The level as the clinic's description names it." },
      },
      _default: [
        { tag: 'RHD Tertiary', level: 'Tertiary' },
        { tag: 'RHD District', level: 'District' },
        { tag: 'RHD Community', level: 'Community' },
      ],
      _description:
        "The levels the Clinics page offers, as ACT 2.0's, each by its location tag. A clinic's description holds its type and level, as the distro seeds them: 'Public, District level'. Keep the tags the same as clinicLocationTags, which the rest of ACT reads; a clinic's parent is one of the levels whose tag is in clinicLocationTags.cardiac.",
    },
    types: {
      _type: Type.Array,
      _elements: { _type: Type.String },
      _default: ['Public', 'Private Not-For-Profit', 'Private For-Profit'],
      _description: "The types the Clinics page offers, as ACT 2.0's; a clinic keeps a type of its own when edited.",
    },
    newClinicTags: {
      _type: Type.Array,
      _elements: { _type: Type.String },
      _default: ['Visit Location', 'Queue Location', 'Login Location'],
      _description:
        'Location tags a clinic added on the Clinics page gets beside its level, so users sign in and record visits there.',
    },
  },
  flagLists: {
    namePrefix: {
      _type: Type.String,
      _default: 'RHD ',
      _description:
        "The registry's Flags column and filter show the flags whose names start with this, unless names is set. Each worklist names its own flag in its extension's config.",
    },
    names: {
      _type: Type.Array,
      _elements: { _type: Type.String },
      _default: [],
      _description:
        "The flags, by name, that the registry's Flags column and filter show. When set, namePrefix is not used.",
    },
    riskFlags: {
      _type: Type.Array,
      _elements: { _type: Type.String },
      _default: ['RHD prophylaxis overdue', 'RHD oral prophylaxis overdue', 'RHD lost to follow-up'],
      _description:
        'The flags, by name, that mark a clinical risk: red in the registry. Every other flag is missing data, orange, unless earlyWarningFlags names it.',
    },
    earlyWarningFlags: {
      _type: Type.Array,
      _elements: { _type: Type.String },
      _default: [
        'RHD cardiology follow-up due',
        'RHD INR review due',
        'RHD no data for 5 months',
        'RHD referred to a clinician',
      ],
      _description:
        "The flags, by name, that warn of care coming due rather than of missing data: blue in the registry, as the chart draws the distro's RHD Early Warning priority. A flag listed here and in riskFlags counts as a risk.",
    },
    flagForms: {
      _type: Type.Array,
      _elements: {
        flag: { _type: Type.UUID, _description: 'The flag, by uuid.' },
        form: { _type: Type.UUID, _description: 'The form to record the missing data on, by uuid.' },
        concept: {
          _type: Type.UUID,
          _default: '',
          _description: 'The question to open the form at, by concept uuid; leave it out to open the form at the top.',
        },
      },
      _default: [
        {
          flag: 'b1f7a2c0-0005-4a00-9000-000000000005',
          form: '4b063fc7-996f-3001-8500-8940e201be8f',
          concept: '668e0221-8b41-5669-9ad8-78e193d42494',
        },
      ],
      _description:
        "The form a flag's missing data is recorded on when the patient has no saved form to complete. The flag's workspace offers it as a new form, also for a flag whose criteria list no missing data, such as a risk flag; a flag not listed here offers the clinical forms list.",
    },
  },
  quickActions: {
    registerPatientUrl: link(
      'Where the Register patient quick action on ACT home and on Home leads.',
      '${openmrsSpaBase}/patient-registration',
    ),
    enterProphylaxisInFastDataEntry: {
      _type: Type.Boolean,
      _default: false,
      _description:
        "Whether Enter prophylaxis on ACT home leads to fast data entry (prophylaxisForms, else enterProphylaxisUrl). When false, it opens Enter prophylaxis, the registry's patients on prophylaxis with Record BPG or Record oral on each. It covers Enter prophylaxis only: Record BPG injection and Record oral prophylaxis always open the patient search.",
    },
    enterProphylaxisUrl: link(
      'Where the Enter prophylaxis quick action on ACT home leads, when enterProphylaxisInFastDataEntry is true and prophylaxisForms is empty: the fast data entry app.',
      '${openmrsSpaBase}/forms',
    ),
    prophylaxisForms: {
      _type: Type.Array,
      _elements: {
        label: {
          _type: Type.String,
          _description: 'The choice as ACT home shows it: a translation key, or text shown as written.',
        },
        url: { _type: Type.String, _description: 'Where the choice leads.' },
      },
      // Keep these markers: extraction reads them to give en.json the default labels as keys.
      // t('enterBpg', 'Enter BPG')
      // t('enterOralProphylaxis', 'Enter oral prophylaxis')
      _default: [
        { label: 'enterBpg', url: '${openmrsSpaBase}/forms/form/0119d2e6-e2e1-391c-9b88-d59a10b0780d' },
        { label: 'enterOralProphylaxis', url: '${openmrsSpaBase}/forms/form/ba29e982-ce18-302a-9fc4-d4b2c3983465' },
      ],
      _description:
        'The choices the Enter prophylaxis quick action offers when enterProphylaxisInFastDataEntry is true, as ACT 2.0 offered BPG and oral prophylaxis; by default the RHD BPG Delivery and RHD Oral Adherence forms in fast data entry. When empty, Enter prophylaxis leads to enterProphylaxisUrl.',
    },
    findPatientInPanel: {
      _type: Type.Boolean,
      _default: true,
      _description:
        "Whether Find a patient on ACT home and on Home opens ACT's patient search over the page. When false, it leads to findPatientUrl.",
    },
    findPatientUrl: link(
      'Where the Find a patient quick action on ACT home and on Home leads when findPatientInPanel is false. The empty query keeps the search page loading when it is refreshed: the patient search app of 11.1.1-pre fails on a /search page load without one.',
      '${openmrsSpaBase}/search?query=',
    ),
  },
  dataClerkQuickActions: {
    facilityReportUrl: link(
      'Where the Facility report quick action on Home leads (Facility reports), for a user holding App: act.dataClerk.',
      '${openmrsSpaBase}/home/act-facility-reports',
    ),
  },
  instanceAdminQuickActions: {
    formsAndSitesUrl: link(
      "Where the Forms & sites quick action on the Instance dashboard leads: OpenMRS's forms list, for a user holding App: act.instanceAdmin.",
      '${openmrsBase}/admin/forms/form.list',
    ),
    rolePermissionsUrl: link(
      "Where the Role permissions quick action on the Instance dashboard leads: ACT's Role permissions page, which sets the capabilities each ACT role has.",
      '${openmrsSpaBase}/home/act-role-permissions',
    ),
    researchParticipationUrl: link(
      "Where the Research participation quick action on the Instance dashboard leads: OpenMRS's module configuration, for a user holding App: act.instanceAdmin.",
      '${openmrsBase}/admin/maintenance/settings.list',
    ),
  },
  instanceAdminKpis: {
    report: {
      _type: Type.String,
      _default: '6494be01-b4ae-46af-8d7f-058a2f95c115',
      _description:
        "The RHD Instance KPIs report, by uuid or name, run for the last seven days: one row whose encounters column is Entered this week (RHD forms dated in the range), and whose active_patients and active_complete columns give Data completeness (the patients on the registry now, and those of them on no Critical data flag's list).",
    },
  },
  users: {
    roleChoices: {
      _type: Type.Array,
      _elements: {
        _type: Type.Object,
        administratorRole: {
          _type: Type.UUID,
          _description: 'The role, by uuid, of the administrator these roles are offered to.',
        },
        roles: {
          _type: Type.Array,
          _elements: { _type: Type.UUID },
          _description: 'The roles, by uuid, they may give.',
        },
      },
      _default: [
        {
          administratorRole: 'c95f35f4-0422-46a3-a593-a6615fab90bc',
          roles: [
            'b9ab4b76-e7b9-46a7-b4ec-5b7fdd8fa540',
            '61e9bb28-11df-4df1-965d-11ef928d5239',
            '60625a0c-3cea-4fe5-b6ca-615c743ad9d4',
            'a1295a20-7273-4339-b5df-2f8a3a841c77',
            '07a7affa-b7de-46d9-9faa-aac4ef2eccba',
            'c95f35f4-0422-46a3-a593-a6615fab90bc',
          ],
        },
        {
          administratorRole: '07a7affa-b7de-46d9-9faa-aac4ef2eccba',
          roles: [
            'b9ab4b76-e7b9-46a7-b4ec-5b7fdd8fa540',
            '61e9bb28-11df-4df1-965d-11ef928d5239',
            '60625a0c-3cea-4fe5-b6ca-615c743ad9d4',
            'a1295a20-7273-4339-b5df-2f8a3a841c77',
          ],
        },
        {
          administratorRole: 'a1295a20-7273-4339-b5df-2f8a3a841c77',
          roles: [
            'b9ab4b76-e7b9-46a7-b4ec-5b7fdd8fa540',
            '61e9bb28-11df-4df1-965d-11ef928d5239',
            '60625a0c-3cea-4fe5-b6ca-615c743ad9d4',
          ],
        },
      ],
      _description:
        "The roles the Users page offers, as ACT 2.0's: the first entry whose administrator role the signed-in user holds wins; a super user gets the first. By default a global administrator gives any ACT role, an instance administrator the clinician roles and Site Administrator, and a site administrator the clinician roles, which is also all ACT Core lets it give (actcore.users.siteAdministratorRoles).",
    },
  },
  adminLinks: {
    usersUrl: link(
      "Where the left nav's Users and roles leads, for a user holding Edit Users: ACT's Users page, which offers each administrator the roles and clinics they may give.",
      '${openmrsSpaBase}/home/act-users',
    ),
    clinicsUrl: link(
      "Where the left nav's Clinics leads: ACT's Clinics page, for a user holding Manage Locations.",
      '${openmrsSpaBase}/home/act-clinics',
    ),
    studiesUrl: link(
      "Where the left nav's Studies leads: the Studies dashboard in this app, for a user holding App: act.studies.",
      '${openmrsSpaBase}/home/act-studies',
    ),
    refreshFlagsUrl: link(
      "Where the left nav's Flags and adherence leads: the page that refreshes them now, for a user holding Task: act.refreshFlags.",
      '${openmrsSpaBase}/home/act-refresh-flags',
    ),
    logsUrl: link(
      "Where the left nav's Logs leads: ACT's Logs page (Activity, Patients opened, Downloads and Sign-ins), for a user holding View Audit Logs, View Read Audit Logs or View Security Audit Logs.",
      '${openmrsSpaBase}/home/act-logs',
    ),
    auditLogsUrl: link(
      "Where the Activity tab's links to the audit module lead: the module's own Audit Logs page, which lists every revision of every entity, including the server's own setup. A row's link adds the user as its username filter.",
      '${openmrsBase}/module/auditlogweb/auditlogs.form',
    ),
    readAuditUrl: link(
      "Where the Patients opened tab's link to the audit module leads: the module's read audit page, with every read.",
      '${openmrsBase}/module/auditlogweb/readauditlogs.form',
    ),
    securityAuditUrl: link(
      "Where the Sign-ins tab's link to the audit module leads: the module's security log page, with locked accounts and the full security record.",
      '${openmrsBase}/module/auditlogweb/securityauditlogs.form',
    ),
    downloadUrl: link(
      "Where the left nav's Download data leads: the download of a form's fields in this app, for a user holding Task: act.downloadData or Task: act.downloadResearchData.",
      '${openmrsSpaBase}/home/act-download',
    ),
  },
  careCascade: {
    report: {
      _type: Type.String,
      _default: '9c6751ae-65fc-5f25-9aa6-8c65cb1dff68',
      _description:
        'The care cascade report, by uuid or name. The ACT home widget and the Dashboard draw its rows, one per step, from their step and patients columns.',
    },
    reportUrl: link("Where the care cascade widget's link to the full report leads.", '${openmrsSpaBase}/reports'),
    steps: {
      _type: Type.Array,
      _elements: {
        _type: Type.Object,
        step: { _type: Type.String, _description: "The report row's step value." },
        label: {
          _type: Type.String,
          _description:
            'What the ACT home widget and the Dashboard call it: a translation key, or text shown as written.',
        },
      },
      // Keep these markers: extraction reads them to give en.json the default labels as keys.
      // t('active', 'Active')
      // t('prescribed', 'Prescribed')
      // t('initiated', 'Initiated')
      // t('coveredToday', 'Covered today')
      // t('adherentEightyPercent', 'Adherent (80%+)')
      _default: [
        { step: 'Active', label: 'active' },
        { step: 'Prescribed', label: 'prescribed' },
        { step: 'Prescribed Prophylaxis', label: 'prescribed' },
        { step: 'Initiated', label: 'initiated' },
        { step: 'Initiated BPG', label: 'initiated' },
        { step: 'Covered today', label: 'coveredToday' },
        { step: 'Adherent (80%+)', label: 'adherentEightyPercent' },
        { step: 'Adherent', label: 'adherentEightyPercent' },
      ],
      _description:
        "The report's steps the ACT home widget and the Dashboard draw, in this order, each by its step value and with the label it shows. A step the report does not return is left out. The report's Oral and BPG rows split Prescribed, so they are left out by default. The defaults also match the step names the report used before it had Covered today, so a distro on that report still draws its four steps.",
    },
  },
  registry: {
    report: {
      _type: Type.String,
      _default: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
      _description: 'The RHD Patient List report, by uuid or name, whose rows the registry lists.',
    },
    showBpgColumns: {
      _type: Type.Boolean,
      _default: false,
      _description:
        "Show the report's bpg_status and adherence columns and a BPG status filter. Turn on once the report returns them.",
    },
  },
  dashboard: {
    registrantsReport: {
      _type: Type.String,
      _default: '3b0a6c2e-8f41-5d7b-9e15-6a2c4d8f0b71',
      _description:
        "The RHD Dashboard Registrants report, by uuid or name: counts by status, and of the active registrants by sex, age band and disease (its breakdown, label and patients columns), for the Dashboard's registrant figures.",
    },
    waitlistReport: {
      _type: Type.String,
      _default: '9d4e2f7a-1c63-5b08-8a2d-4f6e1b9c3a52',
      _description:
        "The RHD Dashboard Waitlist report, by uuid or name: the open recommendations by procedure and urgency, the patients waiting and the balloon valvuloplasties and surgeries performed (its breakdown, procedure, urgency, patients and recommendations columns), for the Dashboard's waitlist.",
    },
    showScreening: {
      _type: Type.Boolean,
      _default: true,
      _description:
        "Show the Dashboard's screening sections, the screening cascade and the screening from registrations. Turn it off at a site without a screening programme.",
    },
    screeningReport: {
      _type: Type.String,
      _default: '0f4b7c2d-6a1e-5d93-8b47-2c9e1f5a3d68',
      _description:
        "The RHD Dashboard Screening report, by uuid or name: the patients registered in a period by sex, Screen +, age at registration and how the case was detected, for the Dashboard's screening from registrations.",
    },
    registrantPatientsReport: {
      _type: Type.String,
      _default: 'e8296d2d-def8-5f8e-ba2d-78c59859b9e3',
      _description:
        "The RHD Dashboard Registrant Patients report, by uuid or name: the patients behind one of the registrants report's figures, for the Dashboard's links.",
    },
    waitlistPatientsReport: {
      _type: Type.String,
      _default: 'bc987343-8b70-5f95-84a8-d017cffa14da',
      _description:
        "The RHD Dashboard Waitlist Patients report, by uuid or name: the recommendations or patients behind one of the waitlist report's figures, for the Dashboard's links.",
    },
    cascadePatientsReport: {
      _type: Type.String,
      _default: '7c62fcfd-03b2-5d84-9cea-92a43b70ae76',
      _description:
        "The RHD Care Cascade Patients report, by uuid or name: the patients of one care cascade step, for the Dashboard's links.",
    },
    optimisationPatientsReport: {
      _type: Type.String,
      _default: '45c646b2-f223-585e-963a-3c74fe883ae4',
      _description:
        "The RHD Medical Optimisation Patients report, by uuid or name: the patients, consultations or recommendations behind one measure, for the Dashboard's links.",
    },
    medicalOptimisationReport: {
      _type: Type.String,
      _default: '733a512c-3243-4e91-a44a-06a8e5384606',
      _description:
        "The RHD Medical Optimisation report, by uuid or name: one row per measure (its measure, done and not_done columns), for the Dashboard's Medical optimisation.",
    },
    screeningCascadeReport: {
      _type: Type.String,
      _default: '8b257a0c-7e96-5a01-9672-975cae3b0419',
      _description: "The RHD Screening Cascade report, by uuid or name, for the Dashboard's screening cascade.",
    },
    screeningDiagnosesReport: {
      _type: Type.String,
      _default: '6ddf6b36-2789-4733-8433-a877d54795cf',
      _description:
        'The RHD Screening Diagnoses report, by uuid or name: the diagnosis categories and RHD details of the screen-detected, for the Dashboard.',
    },
  },
  procedures: {
    encounterType: {
      _type: Type.UUID,
      _default: 'c9b87090-8768-50be-987e-8ca0a8983429',
      _description:
        "Procedures and Outcomes' encounter type. A procedure recorded there completes the matching interventional recommendation (AR-162).",
    },
    concepts: {
      _type: Type.Object,
      _default: {
        date: '6cbb5176-144a-576b-9b3d-c9e9d6bc5f5a',
        surgeryType: '46f4af80-b783-59f4-beb1-81144ccf3084',
        catheterizationType: 'bb4a77ee-836a-57e7-a262-632fa22288d2',
      },
      _description:
        "Procedures and Outcomes' Date of Procedure, Surgery Type and Catheterization Type. The two types' answers are the consultation's Interventional Recommendation(s) answers, so a recorded procedure matches its recommendation.",
    },
  },
  consultations: {
    encounterType: {
      _type: Type.UUID,
      _default: 'c2503561-c00d-5460-8157-43d594472b4a',
      _description: 'The RHD Consultation Visit encounter type, whose encounters the Consultation visits page lists.',
    },
    form: {
      _type: Type.UUID,
      _default: '4b063fc7-996f-3001-8500-8940e201be8f',
      _description: 'The RHD Consultation Visit form, which Start consultation opens.',
    },
    concepts: {
      _type: Type.Object,
      _default: {
        date: 'c3edefd2-5777-5084-b01e-fd4ca0e40162',
        nyha: '2f51b894-383c-53bb-9997-583e9761d132',
        prophylaxis: '668e0221-8b41-5669-9ad8-78e193d42494',
        dateStopped: 'd75edc42-3213-5a06-9228-4e5735b9594b',
        nextAmount: 'ba4b8a87-2ce8-559e-9a30-45504a9b6c1f',
        nextPeriod: '1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        medication: '0734567e-4f0a-5090-9d74-b953921a30e6',
        medicationDose: '8879385e-d35e-50a3-a3d0-4333d95d4878',
        recommendation: 'ce93d393-1df5-587f-bf11-c373eac2ccf4',
        completed: '1632f8dc-195d-5d67-a52e-6c7a057cb536',
      },
      _description:
        "The consultation's questions: Date of Consultation Visit, NYHA Classification, Secondary Antibiotic Prophylaxis (the group and its regimen share the concept), Date Stopped, Next Consultation Time Amount and Period, Cardiac Medication (group and medicine share the concept) and its Dosing, and Interventional Recommendation(s) (group and procedure share the concept) with its Completed answer.",
    },
    vitaminKAntagonists: {
      _type: Type.Array,
      _elements: { _type: Type.UUID },
      _default: ['5e97fe35-58df-4925-bba7-7c49d75268a1', '3c7f8916-3ab5-5678-83c5-be7c7bb1f5e7'],
      _description:
        'The Cardiac Medication answers that put a patient on warfarin, as the INR flags read them: warfarin and the other vitamin K antagonist. A patient whose latest consultation records one, not stopped, has the INR reviews page and card.',
    },
  },
  inrReviews: {
    encounterType: {
      _type: Type.UUID,
      _default: 'b4bb88a3-9a04-5142-85bd-bb63c270f632',
      _description: 'The RHD INR Monitoring encounter type, whose encounters the INR reviews page lists.',
    },
    form: {
      _type: Type.UUID,
      _default: 'fe4848b2-a0b4-329f-a6a3-6ffc298e09a9',
      _description: 'The RHD INR Monitoring form, which Record INR opens.',
    },
    concepts: {
      _type: Type.Object,
      _default: {
        target: '0778ce12-ddba-5e22-b5fd-92424e8747b4',
        group: 'bd88ecf3-eac2-516a-8949-a93f90d6483b',
        dateTested: 'be9041b1-3948-5de0-a8b1-974e84b95715',
        value: '161482AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        newDose: 'f27f6ed2-48db-5be7-91da-3e2483915462',
        nextInr: '5096AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
      _description:
        "The INR form's questions: INR Target, the INR Value group with its Date Tested, INR Value and New Anticoagulant Dose, and Next INR Date.",
    },
  },
  contactCard: {
    attributeTypes: {
      _type: Type.Object,
      _default: {
        phone: '542c6fd2-05ca-53e3-a4f5-cd23bc1abd8f',
        phoneOwner: 'ea3cb7ae-ffbe-5aee-8343-44977898f675',
        primaryCareClinic: '695f2990-236f-5d7c-b8aa-ddbdb22400f4',
        cardiacClinic: 'fe261119-2911-5b36-be40-8f9827826987',
      },
      _description:
        "The person attribute types the Contact card shows: Primary Phone, Phone Owner Name, Primary Care Clinic and Assigned Cardiac Clinic. The village is the person's address.",
    },
  },
  clinicianPrivilege: {
    _type: Type.String,
    _default: 'Task: act.enterClinicalForms',
    _description:
      'The privilege that marks a clinician for the chart: the Conditions card shows only to its holders, the Prophylaxis card offers its holders both Record BPG and Record oral whatever is prescribed, and its non-holders read "Clinical dashboards are only visible to clinicians" under the chart\'s pages.',
  },
  waitingList: {
    report: {
      _type: Type.String,
      _default: '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10',
      _description: 'The Procedural Waiting List report, by uuid or name, whose rows the waiting list shows.',
    },
  },
  dueForProphylaxis: {
    report: {
      _type: Type.String,
      _default: 'f3d8b672-a8a3-47a3-8a0b-dff01de6e3a8',
      _description:
        'The Due for Prophylaxis report, by uuid or name, whose rows the Due for prophylaxis page and widget list.',
    },
  },
  screenPositive: {
    report: {
      _type: Type.String,
      _default: 'e3b8f7a2-6c41-4d9e-8a57-1f0c2d4b9e63',
      _description:
        'The Screen Positive, Pending Confirmation report, by uuid or name, whose rows the screen positive list shows.',
    },
  },
  studies: {
    participantsReport: {
      _type: Type.String,
      _default: 'ea8687da-4bed-5e2b-bafa-7a11ad9bc3ae',
      _description:
        'The RHD Study Participants report, by uuid or name: one row per study enrolment, which Studies lists and counts.',
    },
    studyParticipantIdAttributeType: {
      _type: Type.UUID,
      _default: '7840ba5d-d927-52d6-907b-dd070bea6626',
      _description: "The program attribute type that holds a participant's ID in a study, as ACT 2.0's Study ID.",
    },
    researchOptInAttributeType: {
      _type: Type.UUID,
      _default: 'a78f6ae3-faec-5db8-9493-53877985ca7f',
      _description:
        'The person attribute type, of Concept format, that records whether the patient would like to be considered for research.',
    },
    consentAttributeType: {
      _type: Type.UUID,
      _default: 'e15bf9b7-249e-5d75-907d-937b8d9b0c46',
      _description:
        'The person attribute type, of Concept format, that records registry consent at registration. A patient is enrolled in a study only after consenting, as ACT Core requires.',
    },
    yesConcept: concept(
      'The Yes answer of registry consent and of the research opt-in.',
      '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    ),
    noConcept: concept('The No answer of the research opt-in.', '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  },
  programmeReport: {
    report: {
      _type: Type.String,
      _default: 'c4a9e2d1-7b3f-4e58-9a16-2f0d8b5c7e31',
      _description:
        'The RHD Programme Report, by uuid or name, whose rows (one per primary care clinic) the Reports and Facility reports pages show.',
    },
  },
  cardiacTests: {
    echoForm: {
      _type: Type.UUID,
      _default: '88e54fb0-1243-3f7a-b925-f64648ca6635',
      _description: "The form the chart's Cardiac tests page opens from Add.",
    },
    echoEncounterType: {
      _type: Type.UUID,
      _default: '730f5ec2-7102-55d0-8602-2d792844f245',
      _description: "The encounter type of the echocardiograms the Cardiac tests page lists, the echo form's.",
    },
    concepts: {
      date: concept(
        'Date of Echocardiogram, the date a row shows; without one, the encounter date.',
        '911be530-9457-54be-8515-4bbcdb832ccb',
      ),
      mitralRegurgitation: concept(
        'Mitral Regurgitation, the Mitral regurgitation column.',
        'd6ab05e2-1ece-5f8f-893d-74739aa66ce5',
      ),
      mitralStenosis: concept(
        'Mitral stenosis severity, the Mitral stenosis column.',
        'ed209fc3-0138-516c-a0bd-bcd3b2697a87',
      ),
      aorticRegurgitation: concept(
        'Aortic Regurgitation, the Aortic regurgitation column.',
        '0bbc510f-1e95-5c74-bbe3-8896907fd6c1',
      ),
      aorticStenosis: concept('Aortic Stenosis, the Aortic stenosis column.', '7586c9a6-73db-5ab2-8f23-71a3cc4bae62'),
      ejectionFraction: concept(
        'Left Ventricular Ejection Fraction, the Left ventricular ejection fraction column, in %.',
        'ed630fda-8451-53c0-929e-40eafd9bca9b',
      ),
    },
    ecgForm: {
      _type: Type.UUID,
      _default: '3776bb8d-4741-3741-aeef-d5b760443569',
      _description: "The form the Cardiac tests page's Electrocardiograms card opens from Add.",
    },
    ecgEncounterType: {
      _type: Type.UUID,
      _default: '64c3f35f-a3ec-59d6-8178-0ca9f068cda8',
      _description: "The encounter type of the electrocardiograms the Cardiac tests page lists, the ECG form's.",
    },
    ecgConcepts: {
      date: concept(
        'Date of Electrocardiogram, the date a row shows; without one, the encounter date.',
        'a85d4e63-500f-5af9-8ebd-9e1db5ddc3ed',
      ),
      result: concept(
        'Electrocardiogram Result, the Result column, one answer per finding.',
        '1c5476e4-ff12-5fbd-b2ad-53f66f9006a0',
      ),
      otherFinding: concept(
        'Other Electrocardiogram Finding, the Other finding column.',
        '67d65827-eea5-57ac-ae8b-77f91d128063',
      ),
    },
  },
  prophylaxisPage: {
    bpgEncounterType: {
      _type: Type.UUID,
      _default: '04cf03db-3b8e-5020-84b0-50b06338767a',
      _description: "The encounter type of the BPG injections the chart's Prophylaxis page lists, the BPG form's.",
    },
    oralEncounterType: {
      _type: Type.UUID,
      _default: '55271793-ef37-58da-9d86-1d9092a5a809',
      _description: "The encounter type of the oral adherence entries the Prophylaxis page lists, the oral form's.",
    },
    concepts: {
      injectionDate: concept(
        'Date of Injection, the date a BPG row shows. A BPG visit without one was withheld, so it is not listed or counted as recorded today.',
        '183fb30e-b861-5b7c-806f-7118a40f2b51',
      ),
      doseGiven: concept(
        'Dose given, the BPG dose a row shows; an injection saved before the form asked it has none.',
        '6a52b6aa-2427-4fa2-93cb-18956f50c16a',
      ),
      facility: concept(
        'Facility, a location picked on the BPG form; without one, the encounter location.',
        '01e6dd39-b8ba-5b0a-bcd7-6b8d5973c1bc',
      ),
      lateReason: concept(
        'If injection(s) late, why?, the reasons a late injection tag names.',
        'f7cbfcdc-58bb-5e85-86ab-ffce26a08615',
      ),
      estimateDate: concept(
        'Date of Adherence Estimate, the date an oral row shows; without one, the encounter date.',
        '99512ab5-208e-5c37-8f7b-8f72abe2a0db',
      ),
      adherence: concept(
        'Adherence Estimate, the percentage an oral row shows.',
        '8edff8dc-4af6-5d0f-bf1d-8e349c7a1b15',
      ),
      basedOn: concept(
        'Adherence Based On, what an oral row says the estimate was based on.',
        '4313005d-d5b2-5d20-bf33-39aab1bf90c0',
      ),
      lowAdherenceReason: concept(
        'Explanation if Adherence is Below 80%, the reason an oral row gives for low adherence.',
        'a9fbf67b-65d7-57f6-8270-7bb65cd49469',
      ),
      newPrescription: concept(
        'New Prescription Duration, the supply an oral row says was given.',
        'cd03af00-de81-5c08-9a02-92f95c00e1ce',
      ),
    },
  },
  nextSteps: {
    enabled: {
      _type: Type.Boolean,
      _default: true,
      _description:
        "Whether the patient summary shows Next steps for this visit, from ACT Core's /actcore/nextsteps. When false, the card is hidden and neither /actcore/nextsteps nor the form list is fetched.",
    },
  },
  prophylaxisCard: {
    bpgForm: {
      _type: Type.UUID,
      _default: '0119d2e6-e2e1-391c-9b88-d59a10b0780d',
      _description:
        "The form Record BPG opens, on the patient summary's Prophylaxis card and the chart's Prophylaxis page, to record a BPG injection.",
    },
    oralForm: {
      _type: Type.UUID,
      _default: 'ba29e982-ce18-302a-9fc4-d4b2c3983465',
      _description:
        "The form Record oral opens, on the patient summary's Prophylaxis card and the chart's Prophylaxis page, to record oral prophylaxis.",
    },
  },
  prophylaxisUpdate: {
    encounterType: {
      _type: Type.UUID,
      _default: '8a51f352-5f1b-4836-a669-536e276a21db',
      _description:
        "The RHD Prophylaxis Update encounter type, which the Prophylaxis card's Update prophylaxis saves. Its edit privilege says who may.",
    },
    concepts: {
      _type: Type.Object,
      _default: {
        prescription: '668e0221-8b41-5669-9ad8-78e193d42494',
        dateStarted: '5bcc7d12-b279-5955-815c-090a1f392071',
        dateStopped: 'd75edc42-3213-5a06-9228-4e5735b9594b',
        reasonStopped: 'fa21e431-e64d-5493-b18c-9a1eaf7ee16a',
        duration: '11117263-f71d-58e2-8363-d2e9b1dbddab',
        consultationDate: 'c3edefd2-5777-5084-b01e-fd4ca0e40162',
        none: '1107AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
      _description:
        "The questions of a prophylaxis prescription as the consultation form records them: Secondary Antibiotic Prophylaxis (the group and its regimen share the concept) with its Date Started, Date Stopped and Reason Stopped, the encounter's Secondary Antibiotic Prophylaxis Duration, the Date of Consultation Visit that ACT Core dates a prescription by when there is one, and the None answer that prescribes nothing.",
    },
    regimens: {
      _type: Type.Array,
      _elements: {
        uuid: { _type: Type.UUID, _description: 'The regimen answer.' },
        label: { _type: Type.String, _description: 'The choice as the update shows it.' },
      },
      _default: [
        { uuid: '50be4b26-6c5b-5aaa-9254-3bfd313b4522', label: 'Q28 day BPG' },
        { uuid: '2f3ee632-dd14-51b0-a4ec-de10e7958019', label: 'Q21 day BPG' },
        { uuid: '91230c88-6a90-5d45-af50-fa6155fe5dd7', label: 'Q14 day BPG' },
        { uuid: 'b9884219-358a-594b-94f5-f8a8863a25f3', label: 'Oral penicillin V' },
        { uuid: 'f2e06eb2-5c25-5e53-9e01-246112d05976', label: 'Oral sulfadiazine' },
        { uuid: 'fb8b6676-689b-5daa-83f7-1456210c587f', label: 'Oral erythromycin' },
        { uuid: 'f6f25d63-bd1a-51cb-9596-e74a19759429', label: 'Oral clarithromycin' },
        { uuid: '1af922b8-acee-56c8-b184-eaef4e58e23a', label: 'Oral azithromycin' },
        { uuid: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', label: 'Other non-coded' },
      ],
      _description:
        "The regimens Update prophylaxis offers, as the consultation form's Secondary Antibiotic Prophylaxis does.",
    },
    durations: {
      _type: Type.Array,
      _elements: {
        uuid: { _type: Type.UUID, _description: 'The duration answer.' },
        label: { _type: Type.String, _description: 'The choice as the update shows it.' },
      },
      _default: [
        { uuid: '6f2c4ca8-a499-5851-975b-5bfb426143a9', label: '1 year and reassess' },
        { uuid: 'a3f9bcd3-787f-58b3-ae36-c494725a67eb', label: '2 years and reassess' },
        { uuid: '024cdfe6-c2eb-521c-8616-4729ac35439e', label: '5 years or until age 21, whichever is longer' },
        { uuid: 'ecc08a4c-6494-5737-b142-f59d18c07db1', label: '10 years or until age 40, whichever is longer' },
        { uuid: 'e13a5d80-2ba1-5927-b4e6-7369473222e1', label: 'Lifetime' },
      ],
      _description:
        "The durations Update prophylaxis offers, as the consultation form's Secondary Antibiotic Prophylaxis Duration does.",
    },
    reasons: {
      _type: Type.Array,
      _elements: {
        uuid: { _type: Type.UUID, _description: 'The reason answer.' },
        label: { _type: Type.String, _description: 'The choice as the update shows it.' },
      },
      _default: [
        { uuid: '121689AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', label: 'Allergy' },
        { uuid: '148888AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', label: 'Anaphylaxis' },
        { uuid: 'eaf16fa9-03d7-5846-94c3-b02805889ed9', label: 'Provider stopped' },
        { uuid: '39af49bd-5dd0-5acd-8ffb-260bc83dbfd7', label: 'Patient preference' },
        { uuid: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', label: 'Other non-coded' },
      ],
      _description:
        "The reasons Update prophylaxis offers for stopping, as the consultation form's Reason Stopped does.",
    },
  },
  actIdentifierType: {
    _type: Type.UUID,
    _default: '240f85fa-46e1-540e-9234-2796c623f7ea',
    _description: "The identifier type ACT's patient search shows as the patient's ACT ID.",
  },
  patientInformationForm: {
    _type: Type.UUID,
    _default: 'a6646c51-130d-3b59-a442-959bea93487d',
    _description:
      "The RHD Patient Information form, which the Consultation visits card's Update diagnosis opens: the patient's latest for editing when it is in singleRecordForms, as by default.",
  },
  singleRecordForms: {
    _type: Type.Array,
    _elements: { _type: Type.UUID },
    _default: ['a6646c51-130d-3b59-a442-959bea93487d', '7807da80-ee71-3900-bbce-a026e4a8d54d'],
    _description:
      "Forms, by uuid, that hold one current record per patient, as ACT 2.0 kept Patient Information and Research Participation on the patient: ACT's buttons for them (Next steps, a flag's Open form) edit the patient's latest encounter of the form's type when they have one, rather than add a second. The chart's own Clinical forms list still starts a new one. By default RHD Patient Information and RHD Research Participation.",
  },
  visitType: {
    _type: Type.UUID,
    _default: 'bf86d5a7-9511-5c11-acb1-8f8718775cd5',
    _description: 'The visit type an ACT screen starts when it opens a form for a patient with no active visit.',
  },
  sessionTimeout: {
    idleMinutes: {
      _type: Type.Number,
      _default: 30,
      _description:
        "Minutes a user may be idle before they are signed out, as the server's session timeout (Tomcat's default is 30). 0 switches the warning off.",
    },
    warningMinutes: {
      _type: Type.Number,
      _default: 3,
      _description: 'Minutes before the idle time runs out that the warning opens, counting down to the sign-out.',
    },
    keepAliveMinutes: {
      _type: Type.Number,
      _default: 10,
      _description:
        "How often, in minutes, the session is asked for while the user is active, so a long form entered without saving does not let the server's clock run out. Keep it below idleMinutes.",
    },
  },
  urgencyBands: {
    _type: Type.Array,
    _elements: {
      label: {
        _type: Type.String,
        _description:
          'What the waiting list and its Urgency filter call the band: a translation key, or text shown as written.',
      },
      shortLabel: {
        _type: Type.String,
        _description: "What ACT home's waiting list widget calls the band; without one, it uses label.",
      },
      concept: { _type: Type.ConceptUuid, _description: 'The answer that records this band.' },
      deadlineDays: { _type: Type.Number, _description: 'Days allowed before a patient in this band is overdue.' },
    },
    // Keep these markers: extraction reads them to give en.json the default labels as keys.
    // t('urgencyEmergent', '1: Emergent (24 hours)')
    // t('urgencyWithinOneWeek', '1 - within 1 week')
    // t('urgencyWithinOneMonth', '2 - within 1 month')
    // t('urgencyUrgent', '2: Urgent (60 days)')
    // t('urgencyWithinThreeMonths', '3 - within 3 months')
    // t('urgencyElective', '3: Elective (180 days)')
    // t('urgencyWithinSixMonths', '4 - within 6 months')
    _default: [
      {
        label: 'urgencyEmergent',
        shortLabel: '1: Emergent',
        concept: '1fe15210-4490-58b0-a38c-bb0386e98482',
        deadlineDays: 1,
      },
      { label: 'urgencyWithinOneWeek', concept: '406285f2-be72-5594-8664-c8568ad9bc88', deadlineDays: 7 },
      { label: 'urgencyWithinOneMonth', concept: '82c5209b-c183-5bc9-941c-890eba821a44', deadlineDays: 30 },
      {
        label: 'urgencyUrgent',
        shortLabel: '2: Urgent',
        concept: '33bf504a-15f2-5504-9bdc-ddded0b5eb00',
        deadlineDays: 60,
      },
      { label: 'urgencyWithinThreeMonths', concept: '925610f9-1c3c-5396-880f-02a5fe309d53', deadlineDays: 90 },
      {
        label: 'urgencyElective',
        shortLabel: '3: Elective',
        concept: '2666bf97-7400-57c7-b535-7903e22ced34',
        deadlineDays: 180,
      },
      { label: 'urgencyWithinSixMonths', concept: '57e3873e-018e-5ed6-b7d4-5f73ef464cbd', deadlineDays: 180 },
    ],
    _description:
      "Urgency bands for the procedural waiting list, most urgent first: ACT 2.0's three urgencies, which answer the RHD Consultation Visit's Urgency, with the days allowed before a recommendation is overdue. The four answers they replaced keep their old deadlines, for recommendations saved before, and every band sits in deadline order. A recommendation whose answer no band names keeps the answer's name, is not marked overdue and is listed after the bands.",
    _validators: [
      validator(
        (bands: Array<{ concept?: string; deadlineDays?: unknown }>) =>
          bands.every((band) => band.concept && typeof band.deadlineDays === 'number'),
        'Every urgency band needs a concept and a number of deadline days',
      ),
    ],
  },
};

export type EchoField =
  | 'date'
  | 'mitralRegurgitation'
  | 'mitralStenosis'
  | 'aorticRegurgitation'
  | 'aorticStenosis'
  | 'ejectionFraction';

export interface Config {
  clinicLocationTags: { cardiac: Array<string>; primaryCare: Array<string> };
  clinics: { levels: Array<{ tag: string; level: string }>; types: Array<string>; newClinicTags: Array<string> };
  flagLists: {
    namePrefix: string;
    names: Array<string>;
    riskFlags: Array<string>;
    earlyWarningFlags: Array<string>;
    flagForms: Array<{ flag: string; form: string; concept: string }>;
  };
  quickActions: {
    registerPatientUrl: string;
    enterProphylaxisInFastDataEntry: boolean;
    enterProphylaxisUrl: string;
    prophylaxisForms: Array<{ label: string; url: string }>;
    findPatientInPanel: boolean;
    findPatientUrl: string;
  };
  dataClerkQuickActions: {
    facilityReportUrl: string;
  };
  instanceAdminQuickActions: {
    formsAndSitesUrl: string;
    rolePermissionsUrl: string;
    researchParticipationUrl: string;
  };
  instanceAdminKpis: { report: string };
  users: { roleChoices: Array<{ administratorRole: string; roles: Array<string> }> };
  adminLinks: {
    usersUrl: string;
    clinicsUrl: string;
    studiesUrl: string;
    refreshFlagsUrl: string;
    logsUrl: string;
    auditLogsUrl: string;
    readAuditUrl: string;
    securityAuditUrl: string;
    downloadUrl: string;
  };
  careCascade: { report: string; reportUrl: string; steps: Array<{ step: string; label: string }> };
  registry: { report: string; showBpgColumns: boolean };
  dashboard: {
    registrantsReport: string;
    waitlistReport: string;
    showScreening: boolean;
    screeningReport: string;
    registrantPatientsReport: string;
    waitlistPatientsReport: string;
    cascadePatientsReport: string;
    optimisationPatientsReport: string;
    medicalOptimisationReport: string;
    screeningCascadeReport: string;
    screeningDiagnosesReport: string;
  };
  procedures: {
    encounterType: string;
    concepts: Record<'date' | 'surgeryType' | 'catheterizationType', string>;
  };
  consultations: {
    encounterType: string;
    form: string;
    concepts: Record<
      | 'date'
      | 'nyha'
      | 'prophylaxis'
      | 'dateStopped'
      | 'nextAmount'
      | 'nextPeriod'
      | 'medication'
      | 'medicationDose'
      | 'recommendation'
      | 'completed',
      string
    >;
    vitaminKAntagonists: Array<string>;
  };
  inrReviews: {
    encounterType: string;
    form: string;
    concepts: Record<'target' | 'group' | 'dateTested' | 'value' | 'newDose' | 'nextInr', string>;
  };
  contactCard: { attributeTypes: Record<'phone' | 'phoneOwner' | 'primaryCareClinic' | 'cardiacClinic', string> };
  clinicianPrivilege: string;
  waitingList: { report: string };
  dueForProphylaxis: { report: string };
  screenPositive: { report: string };
  programmeReport: { report: string };
  studies: {
    participantsReport: string;
    studyParticipantIdAttributeType: string;
    researchOptInAttributeType: string;
    consentAttributeType: string;
    yesConcept: string;
    noConcept: string;
  };
  cardiacTests: {
    echoForm: string;
    echoEncounterType: string;
    concepts: Record<EchoField, string>;
    ecgForm: string;
    ecgEncounterType: string;
    ecgConcepts: Record<'date' | 'result' | 'otherFinding', string>;
  };
  prophylaxisPage: {
    bpgEncounterType: string;
    oralEncounterType: string;
    concepts: Record<
      | 'injectionDate'
      | 'doseGiven'
      | 'facility'
      | 'lateReason'
      | 'estimateDate'
      | 'adherence'
      | 'basedOn'
      | 'lowAdherenceReason'
      | 'newPrescription',
      string
    >;
  };
  nextSteps: { enabled: boolean };
  prophylaxisCard: { bpgForm: string; oralForm: string };
  prophylaxisUpdate: {
    encounterType: string;
    concepts: Record<
      'prescription' | 'dateStarted' | 'dateStopped' | 'reasonStopped' | 'duration' | 'consultationDate' | 'none',
      string
    >;
    regimens: Array<{ uuid: string; label: string }>;
    durations: Array<{ uuid: string; label: string }>;
    reasons: Array<{ uuid: string; label: string }>;
  };
  actIdentifierType: string;
  patientInformationForm: string;
  singleRecordForms: Array<string>;
  visitType: string;
  sessionTimeout: { idleMinutes: number; warningMinutes: number; keepAliveMinutes: number };
  urgencyBands: Array<{ label?: string; shortLabel?: string; concept: string; deadlineDays: number }>;
}
