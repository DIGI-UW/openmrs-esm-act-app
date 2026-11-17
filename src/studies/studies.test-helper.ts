import { vi } from 'vitest';
import { openmrsFetch } from '@openmrs/esm-framework';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const studies = [
  { uuid: 'arc', name: 'ARC', states: [] },
  { uuid: 'miller', name: 'Miller', states: [] },
];

/** `saveFails` is the REST error a failed save responds with. */
export function backendAnswers(saveFails?: Record<string, unknown>) {
  const posts: Array<{ url: string; body: unknown }> = [];
  mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method === 'POST') {
      posts.push({ url, body: init.body });
      if (saveFails) {
        throw Object.assign(new Error('400'), { responseBody: { error: saveFails } });
      }
      return { data: {} } as never;
    }
    return { data: { results: studies } } as never;
  });
  return posts;
}
