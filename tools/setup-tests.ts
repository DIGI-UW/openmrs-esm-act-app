import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
import { setClinicTimeZone } from '../src/clinic-clock';

// The suite runs with TZ=UTC; a clinic on the same zone keeps every test's local dates the clinic's dates.
setClinicTimeZone('UTC');
