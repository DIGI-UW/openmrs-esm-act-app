import { describe, expect, it } from 'vitest';
import { labelScaleOf } from './dashboard-charts.component';

describe('labelScaleOf', () => {
  it("colours a count by the report's value, whatever name it is shown under", () => {
    const counts = [
      { label: 'Rheumatic Heart Disease/Rheumatic Fever', value: 3, name: 'RAA' },
      { label: 'Normal', value: 1 },
      { label: 'Kawasaki disease', value: 1 },
    ];
    const translated: Record<string, string> = { Normal: 'Normale', 'Kawasaki disease': 'Maladie de Kawasaki' };

    expect(labelScaleOf(counts, (count) => count.name ?? translated[count.label])).toEqual({
      RAA: '#007d79',
      Normale: '#198038',
      // A value with no colour of its own takes the first spare one.
      'Maladie de Kawasaki': '#9f1853',
    });
  });
});
