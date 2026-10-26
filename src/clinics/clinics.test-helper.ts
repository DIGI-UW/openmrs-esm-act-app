import { expect, vi } from 'vitest';
import { openmrsFetch } from '@openmrs/esm-framework';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

export const tagUuids: Record<string, string> = {
  'RHD Tertiary': 'tag-tertiary',
  'RHD District': 'tag-district',
  'RHD Community': 'tag-community',
  'Visit Location': 'tag-visit',
  'Queue Location': 'tag-queue',
  'Login Location': 'tag-login',
  'Main Pharmacy': 'tag-pharmacy',
};
const tags = (...names: Array<string>) => names.map((display) => ({ uuid: tagUuids[display], display }));
const working = ['Visit Location', 'Queue Location', 'Login Location'];

// As the distro seeds a clinic: type and level in its description, a level tag and the working tags.
export const locations = [
  {
    uuid: 'uhi',
    name: 'Uganda Heart Institute Tertiary',
    description: 'Public, Tertiary level',
    retired: false,
    tags: tags('RHD Tertiary', ...working),
    parentLocation: null,
  },
  {
    uuid: 'lira',
    name: 'Lira Regional Referral Hospital',
    description: 'Public, District level',
    retired: false,
    tags: tags('RHD District', ...working),
    parentLocation: { uuid: 'uhi', display: 'Uganda Heart Institute Tertiary' },
  },
  {
    uuid: 'jcrc',
    name: 'JCRC Lubowa',
    description: 'Private Not-For-Profit, District level',
    retired: false,
    tags: tags('RHD District', ...working),
    parentLocation: { uuid: 'uhi', display: 'Uganda Heart Institute Tertiary' },
  },
  {
    uuid: 'amach',
    name: 'Amach HCIV',
    description: 'Public, Community level',
    retired: false,
    tags: tags('RHD Community', ...working),
    parentLocation: { uuid: 'lira', display: 'Lira Regional Referral Hospital' },
  },
  {
    uuid: 'noclinic',
    name: 'No Clinic',
    description: 'No Designation, District level',
    retired: false,
    tags: tags('RHD District'),
    parentLocation: null,
  },
  {
    uuid: 'closed',
    name: 'Closed HCIII',
    description: 'Public, Community level',
    retired: true,
    tags: tags('RHD Community', ...working),
    parentLocation: { uuid: 'lira', display: 'Lira Regional Referral Hospital' },
  },
  {
    uuid: 'old-district',
    name: 'Old District Hospital',
    description: 'Public, District level',
    retired: true,
    tags: tags('RHD District', ...working),
    parentLocation: null,
  },
  {
    uuid: 'mbale',
    name: 'Mbale HCIV',
    description: 'Public, Community level',
    retired: false,
    tags: tags('RHD Community', ...working),
    parentLocation: { uuid: 'old-district', display: 'Old District Hospital' },
  },
  {
    uuid: 'pharmacy',
    name: 'Main Pharmacy',
    description: null,
    retired: false,
    tags: tags('Main Pharmacy'),
    parentLocation: null,
  },
];

export type Call = { url: string; method: string; body: unknown };

/** Pages locations by four, so a test proves every page is read. */
export function backend(fails?: string, clinics = locations) {
  const writes: Array<Call> = [];
  mockOpenmrsFetch.mockImplementation((async (url: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({ url, method, body: init?.body });
      if (fails) {
        throw Object.assign(new Error('400'), { responseBody: { error: { message: fails } } });
      }
      return { data: { uuid: 'new-clinic' } };
    }
    if (url.includes('/locationtag?')) {
      return { data: { results: Object.entries(tagUuids).map(([display, uuid]) => ({ uuid, display })) } };
    }
    if (url.includes('/location?')) {
      expect(url).toContain('includeAll=true');
      const start = Number(new URLSearchParams(url.split('?')[1]).get('startIndex') ?? 0);
      return { data: { results: clinics.slice(start, start + 4), totalCount: clinics.length } };
    }
    return { data: {} };
  }) as never);
  return writes;
}
