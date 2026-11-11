import React, { useEffect, useRef, useState } from 'react';
import styles from './scroll-edges.scss';

/** Wraps a Carbon table and shades each edge it scrolls past, as macOS and touch devices hide the scrollbar. */
export function ScrollEdges({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const scroller = ref.current.querySelector<HTMLElement>('.cds--data-table-content');
    if (!scroller) {
      return;
    }
    const measure = () => {
      const start = scroller.scrollLeft > 0;
      const end = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
      setEdges((shown) => (shown.start === start && shown.end === end ? shown : { start, end }));
    };
    measure();
    scroller.addEventListener('scroll', measure, { passive: true });
    // The table too, as a new page of rows changes how wide it is and not the scroller.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(scroller);
    const table = scroller.querySelector('table');
    if (table) {
      observer?.observe(table);
    }
    return () => {
      scroller.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, []);
  return (
    <div
      ref={ref}
      className={styles.scrollEdges}
      data-testid="scroll-edges"
      data-more-start={edges.start || undefined}
      data-more-end={edges.end || undefined}
    >
      {children}
    </div>
  );
}
