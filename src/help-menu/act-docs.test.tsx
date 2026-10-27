import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import ActContact from './act-contact.component';
import ActDocs from './act-docs.component';

function configure(helpMenu: Partial<Config['helpMenu']>) {
  const defaults = getDefaultsFromConfigSchema<Config>(configSchema);
  vi.mocked(useConfig<Config>).mockReturnValue({ ...defaults, helpMenu: { ...defaults.helpMenu, ...helpMenu } });
}

describe('Help menu', () => {
  it('shows neither Contact us nor Docs until a site sets them', () => {
    configure({});
    const { container } = render(
      <>
        <ActContact />
        <ActDocs />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('links Contact us and Docs to what the site sets', () => {
    configure({ contactUrl: 'mailto:McCall.Miller@cchmc.org', docsUrl: 'https://docs.example.org/act' });
    render(
      <>
        <ActContact />
        <ActDocs />
      </>,
    );

    expect(screen.getByRole('link', { name: /Contact us/ })).toHaveAttribute('href', 'mailto:McCall.Miller@cchmc.org');
    expect(screen.getByRole('link', { name: /Docs/ })).toHaveAttribute('href', 'https://docs.example.org/act');
  });
});
