import { describe, expect, it } from 'vitest';
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

describe('logTime', () => {
  it('says Today and the clock time for an entry of today', () => {
    expect(logTime('2026-10-21T10:52:14.000Z', now)).toBe('Today, 10:52');
  });

  it("says Yesterday and the clock time for yesterday's entry", () => {
    expect(logTime('2026-10-20T17:05:00.000Z', now)).toBe('Yesterday, 17:05');
  });

  it('gives the full date and clock time for an older entry', () => {
    expect(logTime('2026-10-18T16:40:00.000Z', now)).toBe('18-Oct-2026, 16:40');
  });

  it('gives a window its end time when reads were folded, and a lone read its time alone', () => {
    expect(logTimeRange('2026-10-21T07:41:20.000Z', '2026-10-21T07:48:17.000Z', now)).toBe('Today, 07:41 to 07:48');
    expect(logTimeRange('2026-10-21T07:31:00.000Z', '2026-10-21T07:31:00.000Z', now)).toBe('Today, 07:31');
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
    expect(describeSignInDetails('{"failureReason":"Invalid credential","accountLocked":false}')).toBe(
      'Invalid credential',
    );
    expect(describeSignInDetails('{"failureReason":"Invalid credential","accountLocked":true}')).toBe(
      'Invalid credential, account locked',
    );
  });

  it('keeps plain details as they are, and gives nothing for none', () => {
    expect(describeSignInDetails('Session expired')).toBe('Session expired');
    expect(describeSignInDetails('')).toBe('');
    expect(describeSignInDetails(null)).toBe('');
  });
});

describe('describeBrowser', () => {
  it('names the browser and system from a user agent', () => {
    expect(
      describeBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome on macOS');
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe(
      'Firefox on Windows',
    );
    expect(
      describeBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      ),
    ).toBe('Edge on Windows');
  });

  it('keeps an agent that is not a known browser, such as curl, as it is', () => {
    expect(describeBrowser('curl/8.7.1')).toBe('curl/8.7.1');
    expect(describeBrowser(null)).toBe('');
  });

  it('joins the address and browser for the From line', () => {
    expect(describeClient('172.21.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0.0.0')).toBe(
      '172.21.0.1, Chrome on macOS',
    );
    expect(describeClient(null, null)).toBe('');
  });
});
