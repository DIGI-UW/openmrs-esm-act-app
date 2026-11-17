import { type RefObject, useEffect, useRef, useState } from 'react';
import { readBarcodeOnCanvas } from './barcode';

const scanEveryMs = 200;

/**
 * Reads barcodes from the back camera into the video while `reading`: hands the first one read to `onRead` and stops
 * looking, and stops the camera once `reading` turns false. Returns why the camera could not start, if it could not.
 */
export function useBarcodeCamera(video: RefObject<HTMLVideoElement>, reading: boolean, onRead: (text: string) => void) {
  const [error, setError] = useState<Error>(null);
  const read = useRef(onRead);
  read.current = onRead;

  useEffect(() => {
    if (!reading) {
      return;
    }
    const element = video.current;
    let stopped = false;
    let stream: MediaStream;
    let timer: ReturnType<typeof setTimeout>;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
      if (element.videoWidth) {
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        context.drawImage(element, 0, 0);
        const text = readBarcodeOnCanvas(canvas);
        if (text) {
          read.current(text);
          return;
        }
      }
      timer = setTimeout(scan, scanEveryMs);
    };

    const start = async () => {
      setError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser gives no access to a camera here; it needs HTTPS.');
        }
        // A sticker's narrow bars read better above the camera's default resolution.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        element.srcObject = stream;
        await element.play();
        scan();
      } catch (e) {
        if (!stopped) {
          setError(e);
        }
      }
    };
    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      element.srcObject = null;
    };
  }, [reading, video]);

  return error;
}
