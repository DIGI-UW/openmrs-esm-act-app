import { onTestFinished, vi } from 'vitest';
import * as reactI18next from 'react-i18next';

// The shared mock's t, taken before any test can spy on it.
const plain = reactI18next.useTranslation().t;

/**
 * Wraps every string t returns in «», for this test only, so the test can tell text the app passes to t, which
 * a locale can translate, from text it shows as given.
 */
export function markTranslations() {
  const t = vi
    .spyOn(reactI18next.useTranslation(), 't')
    .mockImplementation(((...args: Parameters<typeof plain>) => `«${plain(...args)}»`) as never);
  onTestFinished(() => t.mockRestore());
  return t;
}
