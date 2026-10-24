import { onTestFinished, vi } from 'vitest';
import * as reactI18next from 'react-i18next';

// The shared mock's t, taken before any test can spy on it.
const plain = reactI18next.useTranslation().t;

/**
 * Wraps what t returns in «» until this test ends, so a test can tell text offered to translation from text
 * shown as given.
 */
export function markTranslations() {
  const t = vi
    .spyOn(reactI18next.useTranslation(), 't')
    .mockImplementation(((...args: Parameters<typeof plain>) => `«${plain(...args)}»`) as never);
  onTestFinished(() => t.mockRestore());
  return t;
}
