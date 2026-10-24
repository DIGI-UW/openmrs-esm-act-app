import { onTestFinished, vi } from 'vitest';
import * as reactI18next from 'react-i18next';

/**
 * Wraps every string t returns in «», for this test only, so the test can tell text the app passes to t, which
 * a locale can translate, from text it shows as given. Otherwise answers as the shared react-i18next mock does.
 */
export function markTranslations() {
  const t = vi.spyOn(reactI18next.useTranslation(), 't').mockImplementation(((
    key: string,
    options?: string | Record<string, unknown>,
    values?: object,
  ) => {
    const text = typeof options === 'string' ? options : String(options?.defaultValue ?? key);
    const named = { ...(typeof options === 'object' ? options : {}), ...values };
    return `«${Object.entries(named).reduce((s, [name, value]) => s.replaceAll(`{{${name}}}`, String(value)), text)}»`;
  }) as never);
  onTestFinished(() => t.mockRestore());
  return t;
}
