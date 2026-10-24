import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import * as reactI18next from 'react-i18next';
import { markTranslations } from '../i18n.test-helper';
import {
  describeBrowser,
  describeClient,
  describeSignInDetails,
  fullTime,
  logTime,
  logTimeRange,
  parseAuditTime,
} from './log-time';

const now = new Date('2026-10-21T12:00:00.000Z');
const { t } = reactI18next.useTranslation();

describe('logTime', () => {
  it('says Today and the clock time for an entry of today', () => {
    expect(logTime(t, '2026-10-21T10:52:14.000Z', now)).toBe('Today, 10:52');
  });

  it("says Yesterday and the clock time for yesterday's entry", () => {
    expect(logTime(t, '2026-10-20T17:05:00.000Z', now)).toBe('Yesterday, 17:05');
  });

  it('gives the full date and clock time for an older entry', () => {
    expect(logTime(t, '2026-10-18T16:40:00.000Z', now)).toBe('18-Oct-2026, 16:40');
  });

  it('gives a window its end time when reads were folded, and a lone read its time alone', () => {
    expect(logTimeRange(t, '2026-10-21T07:41:20.000Z', '2026-10-21T07:48:17.000Z', now)).toBe('Today, 07:41 to 07:48');
    expect(logTimeRange(t, '2026-10-21T07:31:00.000Z', '2026-10-21T07:31:00.000Z', now)).toBe('Today, 07:31');
  });

  it('offers the words it writes around the clock time to translation', () => {
    markTranslations();
    const marked = reactI18next.useTranslation().t;

    expect(logTime(marked, '2026-10-21T10:52:14.000Z', now)).toBe('«Today, 10:52»');
    expect(logTime(marked, '2026-10-20T17:05:00.000Z', now)).toBe('«Yesterday, 17:05»');
    expect(logTimeRange(marked, '2026-10-21T07:41:20.000Z', '2026-10-21T07:48:17.000Z', now)).toBe(
      '««Today, 07:41» to 07:48»',
    );
  });

  it('keeps an apostrophe in a translated Today as it is when it heads a window', async () => {
    const french = i18next.createInstance();
    await french.init({
      lng: 'fr',
      resources: { fr: { translation: { logToday: "Aujourd'hui, {{time}}" } } },
    });

    expect(logTimeRange(french.t, '2026-10-21T07:41:20.000Z', '2026-10-21T07:48:17.000Z', now)).toBe(
      "Aujourd'hui, 07:41 to 07:48",
    );
  });

  it('writes the exact timestamp to the second for the expanded row', () => {
    expect(fullTime('2026-10-21T10:52:14.000Z')).toBe('21-Oct-2026, 10:52:14');
  });
});

describe('parseAuditTime', () => {
  it("turns the audit module's 21/10/2026 20:42:49 into an ISO time, taking it as UTC whatever the browser's zone", () => {
    expect(parseAuditTime('21/10/2026 20:42:49')).toBe('2026-10-21T20:42:49.000Z');
    expect(new Date(parseAuditTime('21/10/2026 20:42:49')).getTime()).toBe(Date.UTC(2026, 9, 21, 20, 42, 49));
  });

  it('keeps a time already in ISO form', () => {
    expect(parseAuditTime('2026-10-21T20:42:49.000Z')).toBe('2026-10-21T20:42:49.000Z');
  });
});

describe('describeSignInDetails', () => {
  it("puts the module's JSON failure details into words, noting a locked account", () => {
    expect(describeSignInDetails(t, '{"failureReason":"Invalid credential","accountLocked":false}')).toBe(
      'Invalid credential',
    );
    expect(describeSignInDetails(t, '{"failureReason":"Invalid credential","accountLocked":true}')).toBe(
      'Invalid credential, account locked',
    );
  });

  it('offers its note of a locked account to translation, and not the reason the module wrote', () => {
    markTranslations();

    expect(
      describeSignInDetails(
        reactI18next.useTranslation().t,
        '{"failureReason":"Invalid credential","accountLocked":true}',
      ),
    ).toBe('Invalid credential, «account locked»');
  });

  it('keeps plain details as they are, and gives nothing for none', () => {
    expect(describeSignInDetails(t, 'Session expired')).toBe('Session expired');
    expect(describeSignInDetails(t, '')).toBe('');
    expect(describeSignInDetails(t, null)).toBe('');
  });
});

describe('describeBrowser', () => {
  it('names the browser and system from a user agent', () => {
    expect(
      describeBrowser(
        t,
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome on macOS');
    expect(describeBrowser(t, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe(
      'Firefox on Windows',
    );
    expect(
      describeBrowser(
        t,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      ),
    ).toBe('Edge on Windows');
  });

  it('offers the words joining browser and system to translation, and a browser alone as it is', () => {
    markTranslations();
    const marked = reactI18next.useTranslation().t;

    expect(describeBrowser(marked, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0.0.0')).toBe(
      '«Chrome on macOS»',
    );
    expect(describeBrowser(marked, 'Mozilla/5.0 Chrome/130.0.0.0')).toBe('Chrome');
  });

  it('keeps an agent that is not a known browser, such as curl, as it is', () => {
    expect(describeBrowser(t, 'curl/8.7.1')).toBe('curl/8.7.1');
    expect(describeBrowser(t, null)).toBe('');
  });

  it('joins the address and browser for the From line', () => {
    expect(describeClient(t, '172.21.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0.0.0')).toBe(
      '172.21.0.1, Chrome on macOS',
    );
    expect(describeClient(t, null, null)).toBe('');
  });
});
