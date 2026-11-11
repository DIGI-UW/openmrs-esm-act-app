/** Gives an element the sizes a browser would lay out, which happy-dom does not; change the returned sizes to move it. */
export function laidOut(element: Element, size: { scrollWidth: number; clientWidth: number; scrollLeft?: number }) {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, get: () => size.scrollWidth });
  Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => size.clientWidth });
  Object.defineProperty(element, 'scrollLeft', { configurable: true, get: () => size.scrollLeft ?? 0 });
  return size;
}
