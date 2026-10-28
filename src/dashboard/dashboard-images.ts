import { toPng } from 'html-to-image';

const pixelRatio = 2;

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });

/**
 * A section of the page as a PNG, with a band above it saying what it counts (the clinics and the date) and, for a
 * section without a title of its own, naming it, so the image says what it is wherever it is shared.
 */
export async function sectionPng(element: HTMLElement, title: string, subtitle: string): Promise<Uint8Array> {
  const image = await loadImage(await toPng(element, { backgroundColor: '#ffffff', pixelRatio }));
  const band = (title ? 64 : 36) * pixelRatio;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height + band;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (title) {
    context.fillStyle = '#161616';
    context.font = `600 ${18 * pixelRatio}px 'IBM Plex Sans', sans-serif`;
    context.fillText(title, 16 * pixelRatio, 28 * pixelRatio);
  }
  context.fillStyle = '#525252';
  context.font = `${13 * pixelRatio}px 'IBM Plex Sans', sans-serif`;
  context.fillText(subtitle, 16 * pixelRatio, (title ? 50 : 24) * pixelRatio);
  context.drawImage(image, 0, band);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
