import openmrs from '@openmrs/eslint-config';

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  ...openmrs,
  {
    rules: {
      '@typescript-eslint/triple-slash-reference': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['src/**'],
    ignores: ['src/format-date.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value='@openmrs/esm-framework'] > ImportSpecifier[imported.name=/^formatDate(time)?$/]",
          message: "Import formatDate and formatDatetime from src/format-date, which writes September as 'Sep'.",
        },
        {
          selector:
            "ExportNamedDeclaration[source.value='@openmrs/esm-framework'] > ExportSpecifier[local.name=/^formatDate(time)?$/]",
          message: "Import formatDate and formatDatetime from src/format-date, which writes September as 'Sep'.",
        },
        {
          selector: "ImportDeclaration[source.value='@openmrs/esm-framework'] > ImportNamespaceSpecifier",
          message: 'Import named members from @openmrs/esm-framework, so the formatDate rule can see them.',
        },
      ],
    },
  },
  {
    // Playwright fixtures take a callback named `use` and call it, which
    // eslint-plugin-react-hooks reads as React's `use` hook.
    files: ['e2e/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];
