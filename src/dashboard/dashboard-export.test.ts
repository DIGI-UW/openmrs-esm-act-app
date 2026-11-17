import { describe, expect, it } from 'vitest';
import { crc32, slug, zip } from './dashboard-export';

describe('the export helpers', () => {
  it('computes the CRC-32 a zip records', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686);
  });

  it('stores each file in a zip with its name, size and CRC, and a directory that lists them', async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const bytes = new Uint8Array(
      await zip([
        { name: '01-key-figures.png', data },
        { name: '02-waitlist.png', data },
      ]).arrayBuffer(),
    );
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(18, true)).toBe(4);
    expect(view.getUint32(14, true)).toBe(crc32(data));
    expect(new TextDecoder().decode(bytes.slice(30, 48))).toBe('01-key-figures.png');
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const directory = view.getUint32(end + 16, true);
    expect(view.getUint32(directory, true)).toBe(0x02014b50);
  });

  it("names a section's file by its title", () => {
    expect(slug('Screening, from registrations')).toBe('screening-from-registrations');
  });
});
