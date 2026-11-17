/** The patient chart's URL, for ConfigurableLink and navigate to fill in the SPA base. */
export const patientChartUrl = (patientUuid: unknown) => '${openmrsSpaBase}' + `/patient/${patientUuid}/chart`;
