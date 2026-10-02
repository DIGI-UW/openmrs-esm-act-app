import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { getDefaultsFromConfigSchema, navigate, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import ContactCard from './contact-card.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const [phone, ownerRelationship, owner, healthCenter] = [
  '14d4f066-15f5-102d-96e4-000c29c2a5d7',
  'b36b2e80-c1ad-5417-84fc-89075904a089',
  'ea3cb7ae-ffbe-5aee-8343-44977898f675',
  '8d87236c-c2cc-11de-8d13-0010c6dffd0f',
];
const attribute = (type: string, value: unknown) => ({ attributeType: { uuid: type }, value });

function respondWith(person: object | Error) {
  mockOpenmrsFetch.mockImplementation((() =>
    person instanceof Error ? Promise.reject(person) : Promise.resolve({ data: person })) as never);
}

function renderCard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <ContactCard patientUuid="winnie" />
    </SWRConfig>,
  );
}

const field = (name: string) => screen.getByTestId(`contact-${name}`);

describe('ContactCard', () => {
  beforeEach(() => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    vi.mocked(useConfig<Config>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
  });

  it("shows the patient's phone, its owner, their village and primary clinic", async () => {
    // Shaped as REST answers: a Location attribute as its location, the others as text.
    respondWith({
      attributes: [
        attribute(phone, '+256 701 555 342'),
        attribute(owner, 'Grace Auma'),
        attribute(ownerRelationship, 'Mother'),
        attribute(healthCenter, { uuid: 'kiswa', display: 'Kiswa HC III' }),
      ],
      preferredAddress: { cityVillage: 'Lira' },
    });

    renderCard();

    await waitFor(() => expect(field('phone')).toHaveTextContent('+256 701 555 342'));
    expect(field('phone-owner')).toHaveTextContent('Mother');
    expect(field('village')).toHaveTextContent('Lira');
    expect(field('primary-clinic')).toHaveTextContent('Kiswa HC III');
    expect(String(mockOpenmrsFetch.mock.calls[0][0])).toContain(`${restBaseUrl}/person/winnie?`);
  });

  it("names the phone's owner when no relationship is recorded", async () => {
    respondWith({ attributes: [attribute(owner, 'Grace Auma')], preferredAddress: null });

    renderCard();

    await waitFor(() => expect(field('phone-owner')).toHaveTextContent('Grace Auma'));
  });

  it('shows -- for what is not recorded', async () => {
    respondWith({ attributes: [], preferredAddress: { cityVillage: null } });

    renderCard();

    await waitFor(() => expect(field('phone')).toHaveTextContent('--'));
    expect(field('phone-owner')).toHaveTextContent('--');
    expect(field('village')).toHaveTextContent('--');
    expect(field('primary-clinic')).toHaveTextContent('--');
  });

  it("edits the patient's details in registration", async () => {
    respondWith({ attributes: [], preferredAddress: null });

    renderCard();

    await userEvent.click(screen.getByRole('button', { name: /^Edit/ }));

    expect(navigate).toHaveBeenCalledWith({
      to: '${openmrsSpaBase}/patient/${patientUuid}/edit',
      templateParams: { patientUuid: 'winnie' },
    });
  });

  it('shows nothing when the details cannot be loaded', async () => {
    respondWith(new Error('Forbidden'));

    const { container } = renderCard();

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
