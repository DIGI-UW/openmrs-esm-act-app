import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  type AssignedExtension,
  getAssignedExtensions,
  getExtensionStore,
  useAssignedExtensions,
} from '@openmrs/esm-framework';
import { useChartPagePath } from './chart-page-path';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  // The framework's test mock has no getAssignedExtensions, which reads a dashboard group's slot.
  getAssignedExtensions: vi.fn(() => []),
}));

const group = { name: 'act-group', config: { slotName: 'act-group-slot' } };
const inrPage = { name: 'act-inr-reviews-dashboard-link', meta: { path: 'act-inr-reviews' }, config: {} };

const fillGroup = (links: Array<object>) =>
  act(() => {
    vi.mocked(getAssignedExtensions).mockImplementation(
      (slot) => (slot === group.config.slotName ? links : []) as Array<AssignedExtension>,
    );
    getExtensionStore().setState({ slots: { [group.config.slotName]: { assignedExtensions: links } } } as never);
  });

describe('useChartPagePath', () => {
  afterEach(() => getExtensionStore().setState({ slots: {} } as never));

  it("follows a dashboard group's slot that fills after the first render", () => {
    vi.mocked(useAssignedExtensions).mockReturnValue([group] as unknown as Array<AssignedExtension>);
    vi.mocked(getAssignedExtensions).mockReturnValue([]);
    const { result } = renderHook(() => useChartPagePath(inrPage.name));
    expect(result.current).toBeNull();

    fillGroup([inrPage]);

    expect(result.current).toBe('act-inr-reviews');
  });

  it("does not re-render when the extension store changes but the page's path does not", () => {
    vi.mocked(useAssignedExtensions).mockReturnValue([group] as unknown as Array<AssignedExtension>);
    fillGroup([inrPage]);
    let hookRuns = 0;
    const { result } = renderHook(() => {
      hookRuns++;
      return useChartPagePath(inrPage.name);
    });
    const runsBefore = hookRuns;

    act(() => getExtensionStore().setState({ slots: { 'some-other-slot': { assignedExtensions: [] } } } as never));

    expect(result.current).toBe('act-inr-reviews');
    expect(hookRuns).toBe(runsBefore);
  });
});
