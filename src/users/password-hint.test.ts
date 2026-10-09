import { describe, expect, it } from 'vitest';
import { type TFunction } from 'i18next';
import { passwordHint } from './password-hint';

// Interpolates as i18next does with the default texts.
const t = ((_: string, text: string, values: Record<string, unknown> = {}) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key]))) as unknown as TFunction;

const coreDefaults = {
  minimumLength: 8,
  requiresUpperAndLowerCase: true,
  requiresDigit: true,
  requiresNonDigit: true,
  cannotMatchUsername: true,
  customRegex: null,
};

describe('passwordHint', () => {
  it("says what core's default rules ask for", () => {
    expect(passwordHint(t, coreDefaults)).toBe(
      'At least 8 characters, with upper and lower case letters, a number, a character that is not a number, not the username',
    );
  });

  it("follows the server's settings", () => {
    expect(
      passwordHint(t, {
        ...coreDefaults,
        minimumLength: 12,
        requiresUpperAndLowerCase: false,
        requiresNonDigit: false,
        cannotMatchUsername: false,
        customRegex: '.*[!@#].*',
      }),
    ).toBe('At least 12 characters, with a number, and it must meet the rule this server sets');
  });

  it('keeps the fixed hint for an ACT Core that does not send the rules', () => {
    expect(passwordHint(t)).toBe('At least 8 characters, with upper and lower case letters and a number');
  });
});
