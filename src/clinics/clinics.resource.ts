import { useMemo } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';

interface Location {
  uuid: string;
  name: string;
  description: string | null;
  retired: boolean;
  tags: Array<{ uuid: string; display: string }>;
  parentLocation: { uuid: string; display: string } | null;
}

/** A location carrying one of the clinic level tags, with its type and level as the Clinics page shows them. */
export interface Clinic extends Location {
  type: string;
  level: string;
}

export interface ClinicForm {
  name: string;
  type: string;
  level: string;
  parent: string;
  enabled: boolean;
}

type Levels = Config['clinics']['levels'];

// A tag search leaves out retired locations even with includeAll, so every location is read and the clinics kept.
const locationsUrl = `${restBaseUrl}/location?includeAll=true&v=custom:(uuid,name,description,retired,tags:(uuid,display),parentLocation:(uuid,display))`;

/** The clinics, enabled and disabled, by name; a clinic's type is the first part of its description, as seeded. */
export function useClinics(levels: Levels) {
  const { data, error, isLoading, mutate } = useSWR<Array<Location>, Error>(locationsUrl, fetchAll);
  const clinics = useMemo(
    () =>
      (data ?? [])
        .map((location): Clinic | null => {
          const level = levels.find(({ tag }) => location.tags.some(({ display }) => display === tag))?.level;
          return level ? { ...location, level, type: location.description?.split(', ')[0] ?? '' } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data, levels],
  );
  return { clinics, error, isLoading, mutate };
}

/** Every location tag's uuid by its name, as a location is saved with its tags' uuids. */
export function useLocationTags() {
  const url = `${restBaseUrl}/locationtag?v=custom:(uuid,display)`;
  const { data, error } = useSWR<Record<string, string>, Error>(url, async () =>
    Object.fromEntries(
      (await fetchAll<{ uuid: string; display: string }>(url)).map(({ uuid, display }) => [display, uuid]),
    ),
  );
  return { tagUuids: data, error };
}

/** Configured location tags the server does not have; OpenMRS answers a save naming one with a server error. */
export class MissingLocationTags extends Error {
  constructor(readonly tags: Array<string>) {
    super(`No location tag named ${tags.join(', ')}`);
  }
}

/**
 * Creates a clinic, or saves the one given: its level tag replaces the old one and its other tags are kept, a new
 * clinic getting the working tags; then enables or disables it if that changed.
 */
export async function saveClinic(
  form: ClinicForm,
  { levels, newClinicTags }: Config['clinics'],
  tagUuids: Record<string, string>,
  existing?: Clinic,
) {
  const levelTags = levels.map(({ tag }) => tag);
  const named = [levels.find(({ level }) => level === form.level).tag, ...(existing ? [] : newClinicTags)];
  const missing = named.filter((tag) => !tagUuids[tag]);
  if (missing.length) {
    throw new MissingLocationTags(missing);
  }
  const kept = (existing?.tags ?? []).filter(({ display }) => !levelTags.includes(display)).map(({ uuid }) => uuid);
  const url = `${restBaseUrl}/location${existing ? `/${existing.uuid}` : ''}`;
  const { data } = await openmrsFetch<{ uuid: string }>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      name: form.name.trim(),
      description: `${form.type}, ${form.level} level`,
      tags: [...named.map((tag) => tagUuids[tag]), ...kept],
      parentLocation: form.parent || null,
    },
  });
  const uuid = existing?.uuid ?? data.uuid;
  if (existing && existing.retired === form.enabled) {
    await openmrsFetch(
      form.enabled
        ? `${restBaseUrl}/location/${uuid}`
        : `${restBaseUrl}/location/${uuid}?reason=Disabled+on+ACT+Clinics`,
      form.enabled
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { retired: false } }
        : { method: 'DELETE' },
    );
  }
  return uuid;
}
