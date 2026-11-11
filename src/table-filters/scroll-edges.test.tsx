import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { laidOut } from './laid-out.test-helper';
import { ScrollEdges } from './scroll-edges.component';

vi.mock('./scroll-edges.scss', () => ({ default: { scrollEdges: 'scrollEdges' } }));

const observed: Array<{ callback: () => void; elements: Array<Element> }> = [];
const originalResizeObserver = globalThis.ResizeObserver;

const edgesOf = (wrapper: Element) => [wrapper.hasAttribute('data-more-start'), wrapper.hasAttribute('data-more-end')];

describe('ScrollEdges', () => {
  beforeEach(() => {
    observed.length = 0;
    globalThis.ResizeObserver = class {
      entry: { callback: () => void; elements: Array<Element> };
      constructor(callback: () => void) {
        this.entry = { callback, elements: [] };
        observed.push(this.entry);
      }
      observe(element: Element) {
        this.entry.elements.push(element);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  const renderTable = () =>
    render(
      <ScrollEdges>
        <div className="cds--data-table-content" data-testid="scroller">
          <table />
        </div>
      </ScrollEdges>,
    );

  it("marks the edges of Carbon's table content that have more of the table beyond them", () => {
    renderTable();
    const scroller = screen.getByTestId('scroller');
    const wrapper = screen.getByTestId('scroll-edges');
    const size = laidOut(scroller, { scrollWidth: 1200, clientWidth: 960 });

    fireEvent.scroll(scroller);
    expect(edgesOf(wrapper)).toEqual([false, true]);

    size.scrollLeft = 120;
    fireEvent.scroll(scroller);
    expect(edgesOf(wrapper)).toEqual([true, true]);

    size.scrollLeft = 240;
    fireEvent.scroll(scroller);
    expect(edgesOf(wrapper)).toEqual([true, false]);
  });

  it('marks no edge on a table that fits', () => {
    renderTable();
    const scroller = screen.getByTestId('scroller');
    laidOut(scroller, { scrollWidth: 960, clientWidth: 960 });

    fireEvent.scroll(scroller);

    expect(edgesOf(screen.getByTestId('scroll-edges'))).toEqual([false, false]);
  });

  it('measures again when the rows change the width of the table, as a new page or filter does', () => {
    renderTable();
    const scroller = screen.getByTestId('scroller');
    const size = laidOut(scroller, { scrollWidth: 960, clientWidth: 960 });
    fireEvent.scroll(scroller);
    expect(edgesOf(screen.getByTestId('scroll-edges'))).toEqual([false, false]);

    size.scrollWidth = 1200;
    act(() => observed.forEach((entry) => entry.callback()));

    expect(edgesOf(screen.getByTestId('scroll-edges'))).toEqual([false, true]);
    expect(observed.flatMap((entry) => entry.elements)).toEqual(
      expect.arrayContaining([scroller, screen.getByRole('table')]),
    );
  });

  it('marks no edge, and does not fail, around something other than a Carbon table', () => {
    render(
      <ScrollEdges>
        <p>No patients to display</p>
      </ScrollEdges>,
    );

    expect(screen.getByText('No patients to display')).toBeInTheDocument();
    expect(edgesOf(screen.getByTestId('scroll-edges'))).toEqual([false, false]);
  });

  it('draws a shadow over a marked edge only', () => {
    const sheet = readFileSync(resolve(process.cwd(), 'src/table-filters/scroll-edges.scss'), 'utf8');

    expect(sheet).toMatch(/&\[data-more-start\]::before,\s*&\[data-more-end\]::after\s*\{\s*opacity: 1;/);
    expect(sheet).toMatch(/&::before,\s*&::after\s*\{[^}]*opacity: 0;[^}]*pointer-events: none;/);
  });
});
