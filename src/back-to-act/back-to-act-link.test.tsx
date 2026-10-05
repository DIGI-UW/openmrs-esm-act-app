import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate } from '@openmrs/esm-framework';
import { nextActReturn, trackActReturn } from './act-return';
import BackToActLink from './back-to-act-link.component';

const base = 'http://localhost/openmrs/spa';
const chart = `${base}/patient/patient-1/chart/Patient Summary`;
const registry = `${base}/home/act-registry?status=Active&cardiac=Lira`;

function route(oldUrl: string, newUrl: string) {
  window.dispatchEvent(new CustomEvent('single-spa:before-routing-event', { detail: { oldUrl, newUrl } }));
}

describe('Back to the ACT page a chart was opened from', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('remembers an ACT page, with its filters, when the chart opens from it', () => {
    expect(nextActReturn(null, registry, chart)).toEqual({
      screen: 'act-registry',
      path: '/openmrs/spa/home/act-registry?status=Active&cardiac=Lira',
    });
  });

  it('keeps it while the user moves between chart pages, and forgets it on leaving the chart', () => {
    const fromRegistry = nextActReturn(null, registry, chart);

    expect(nextActReturn(fromRegistry, chart, `${base}/patient/patient-1/chart/Prophylaxis`)).toBe(fromRegistry);
    expect(nextActReturn(fromRegistry, chart, `${base}/home/service-queues`)).toBeNull();
  });

  it('has nowhere to go back to when the chart opens from a page that is not ACT', () => {
    expect(nextActReturn(null, `${base}/home/service-queues`, chart)).toBeNull();
    expect(nextActReturn(null, `${base}/patient-registration`, chart)).toBeNull();
  });

  it('shows Back to Registry in a chart opened from the registry, and returns there', async () => {
    trackActReturn();
    route(registry, chart);

    render(<BackToActLink />);

    await userEvent.click(screen.getByRole('button', { name: /Back to Registry$/ }));
    expect(navigate).toHaveBeenCalledWith({
      to: '/openmrs/spa/home/act-registry?status=Active&cardiac=Lira',
    });
  });

  it('shows nothing in a chart opened from anywhere else', () => {
    trackActReturn();
    route(`${base}/home/service-queues`, chart);

    const { container } = render(<BackToActLink />);

    expect(container).toBeEmptyDOMElement();
  });
});
