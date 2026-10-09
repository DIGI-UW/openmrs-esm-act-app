import { type TFunction } from 'i18next';
import { type PasswordRules } from './users.resource';

/** What a new password must be, in words, from the server's rules, or core's defaults without them. */
export function passwordHint(t: TFunction, rules?: PasswordRules) {
  if (!rules) {
    return t('passwordRule', 'At least 8 characters, with upper and lower case letters and a number');
  }
  const needs = [
    rules.requiresUpperAndLowerCase && t('passwordNeedsCase', 'upper and lower case letters'),
    rules.requiresDigit && t('passwordNeedsDigit', 'a number'),
    rules.requiresNonDigit && t('passwordNeedsNonDigit', 'a character that is not a number'),
  ].filter(Boolean);
  const parts = [
    t('passwordMinimumLength', 'At least {{count}} characters', { count: rules.minimumLength }),
    needs.length && t('passwordWith', 'with {{needs}}', { needs: needs.join(', ') }),
    rules.cannotMatchUsername && t('passwordNotUsername', 'not the username'),
    rules.customRegex && t('passwordCustomRule', 'and it must meet the rule this server sets'),
  ].filter(Boolean);
  return parts.join(', ');
}
