import { describe, expect, it } from 'vitest';
import { RGBLuminanceSource } from '@zxing/library';
import { readBarcode } from './barcode';

// Code 128 bar and space widths by symbol value, as printed: Start B, then code set B characters, the check symbol
// and Stop.
const code128 = {
  start: [2, 1, 1, 2, 1, 4],
  r: [1, 2, 1, 2, 4, 1],
  h: [1, 2, 2, 4, 1, 1],
  d: [1, 4, 1, 2, 2, 1],
  '0': [1, 2, 3, 1, 2, 2],
  '1': [1, 2, 3, 2, 2, 1],
  checkOfRhd00001: [1, 1, 4, 1, 1, 3],
  stop: [2, 3, 3, 1, 1, 1, 2],
};

/** A sticker's Code 128 barcode of rhd00001, as gray pixels: bars black, spaces and quiet zones white. */
function rhd00001Image(moduleWidth = 3, height = 40) {
  const symbols = [
    code128.start,
    ...[...'rhd00001'].map((c) => code128[c as keyof typeof code128]),
    code128.checkOfRhd00001,
    code128.stop,
  ];
  const quiet = Array(10 * moduleWidth).fill(255);
  const row = [
    ...quiet,
    ...symbols.flatMap((widths) =>
      widths.flatMap((width, i) => Array(width * moduleWidth).fill(i % 2 === 0 ? 0 : 255)),
    ),
    ...quiet,
  ];
  const pixels = new Uint8ClampedArray(row.length * height);
  for (let y = 0; y < height; y++) {
    pixels.set(row, y * row.length);
  }
  return new RGBLuminanceSource(pixels, row.length, height);
}

describe('readBarcode', () => {
  it("reads the ACT ID from a Code 128 barcode, as on OpenMRS's patient identifier sticker", () => {
    expect(readBarcode(rhd00001Image())).toBe('rhd00001');
  });

  it('reads nothing from an image without a barcode', () => {
    expect(readBarcode(new RGBLuminanceSource(new Uint8ClampedArray(200 * 40).fill(255), 200, 40))).toBeNull();
  });
});
