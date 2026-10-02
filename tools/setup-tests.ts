import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// The framework's test mock has no EmptyCardIllustration, the styleguide's empty-state drawing.
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  EmptyCardIllustration: () => React.createElement('svg', { 'data-testid': 'empty-card-illustration' }),
}));

afterEach(cleanup);
