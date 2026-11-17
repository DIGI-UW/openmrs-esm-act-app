import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientCell } from './patient-cell.component';

const row = { patient_uuid: 'patient-1', full_name: 'Amina Nakato', rhd_id: 'rhd00012' };

const renderInCell = (cell: React.ReactElement) =>
  render(
    <table>
      <tbody>
        <tr>
          <td>{cell}</td>
        </tr>
      </tbody>
    </table>,
  );

describe('PatientCell', () => {
  beforeEach(() => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  });

  it("links the patient's name to their chart, with the ACT ID beneath it", () => {
    renderInCell(<PatientCell row={row} />);

    const name = screen.getByRole('link', { name: 'Amina Nakato' });
    expect(name).toHaveAttribute('href', '/openmrs/spa/patient/patient-1/chart');
    expect(name).not.toHaveTextContent('rhd00012');
    expect(screen.getByRole('cell')).toHaveTextContent(/^Amina Nakatorhd00012$/);
  });

  it('adds a detail after the ACT ID, and what it is given beside the name', () => {
    renderInCell(
      <PatientCell row={row} detail="14 F">
        <span>*</span>
      </PatientCell>,
    );

    expect(screen.getByRole('cell')).toHaveTextContent(/^Amina Nakato\*rhd00012 · 14 F$/);
    expect(screen.getByRole('link')).toHaveTextContent(/^Amina Nakato$/);
  });

  it('links to another page of the chart when given one', () => {
    render(<PatientCell row={row} to="${openmrsSpaBase}/patient/patient-1/chart/research" />);

    expect(screen.getByRole('link', { name: 'Amina Nakato' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-1/chart/research',
    );
  });
});
