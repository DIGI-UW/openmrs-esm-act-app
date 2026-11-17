import { HTMLCanvasElementLuminanceSource } from '@zxing/browser';
import {
  BarcodeFormat,
  BinaryBitmap,
  ChecksumException,
  DecodeHintType,
  FormatException,
  HybridBinarizer,
  type LuminanceSource,
  MultiFormatReader,
  NotFoundException,
} from '@zxing/library';

const reader = new MultiFormatReader();
reader.setHints(
  new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]),
);

/** The text of the Code128 barcode in the image, as on OpenMRS's patient identifier sticker, or null if none reads. */
export function readBarcode(image: LuminanceSource) {
  try {
    return reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(image))).getText();
  } catch (e) {
    if (e instanceof NotFoundException || e instanceof ChecksumException || e instanceof FormatException) {
      return null;
    }
    throw e;
  }
}

export const readBarcodeOnCanvas = (canvas: HTMLCanvasElement) =>
  readBarcode(new HTMLCanvasElementLuminanceSource(canvas));
