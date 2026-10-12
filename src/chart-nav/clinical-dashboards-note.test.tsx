import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClinicalDashboardsNote from './clinical-dashboards-note.component';

describe('ClinicalDashboardsNote', () => {
  it("tells a community clinician why the chart's nav has fewer pages", () => {
    render(<ClinicalDashboardsNote />);

    expect(screen.getByText('Clinical dashboards are only visible to clinicians.')).toBeInTheDocument();
  });
});
