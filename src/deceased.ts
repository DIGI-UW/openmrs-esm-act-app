/** Whether the patient has died, as their FHIR record says it either way: a flag, or a date of death. */
export const isDeceased = (patient?: fhir.Patient) => Boolean(patient?.deceasedBoolean || patient?.deceasedDateTime);
