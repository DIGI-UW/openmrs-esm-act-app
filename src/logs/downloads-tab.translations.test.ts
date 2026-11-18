import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import en from '../../translations/en.json';

describe("the downloads log's English text", () => {
  it('says "field" for a download of one field', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });

    expect(i18n.t('fieldsAndPeriod', { count: 1, period: 'All dates' })).toBe('1 field, All dates');
    expect(i18n.t('fieldsAndPeriod', { count: 3, period: 'All dates' })).toBe('3 fields, All dates');
  });
});
