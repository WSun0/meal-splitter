'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createWorker, Worker, PSM } from 'tesseract.js';
import { parseReceiptText, isConfidenceAcceptable } from '@/lib/utils/receipt-parser';
import { OCRResult } from '@/lib/types/meal';

export type OCRStatus = 'idle' | 'initializing' | 'ready' | 'processing' | 'error';

/**
 * Preprocess image using Canvas for better OCR results
 * Applies: grayscale, contrast enhancement, and thresholding
 */
async function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Limit size for performance (max 2000px on longest side)
      const maxDim = 2000;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim;
          width = maxDim;
        } else {
          width = (width / height) * maxDim;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Get image data for pixel manipulation
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Convert to grayscale and enhance contrast
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale using luminance formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Enhance contrast (multiply deviation from middle by 1.5)
        let enhanced = 128 + (gray - 128) * 1.5;
        enhanced = Math.max(0, Math.min(255, enhanced));
        
        // Apply threshold for binarization (makes text darker, background lighter)
        const threshold = 140;
        const final = enhanced < threshold ? 0 : 255;
        
        data[i] = final;     // R
        data[i + 1] = final; // G
        data[i + 2] = final; // B
        // Alpha stays the same
      }

      // Put processed image back
      ctx.putImageData(imageData, 0, 0);

      // Return as data URL
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Load image from file
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface UseClientOCRReturn {
  status: OCRStatus;
  progress: number;
  progressMessage: string;
  error: string | null;
  preload: () => Promise<void>;
  processImage: (file: File) => Promise<OCRResult | null>;
  isReady: boolean;
}

export function useClientOCR(): UseClientOCRReturn {
  const [status, setStatus] = useState<OCRStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  // Clean up worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const initializeWorker = useCallback(async () => {
    // If already initialized or initializing, return existing promise
    if (workerRef.current) return;
    if (initPromiseRef.current) return initPromiseRef.current;

    initPromiseRef.current = (async () => {
      try {
        setStatus('initializing');
        setProgress(0);
        setProgressMessage('Loading OCR engine...');
        setError(null);

        const worker = await createWorker('eng', 1, {
          logger: (m) => {
            if (m.status === 'loading tesseract core') {
              setProgress(10);
              setProgressMessage('Loading OCR core...');
            } else if (m.status === 'initializing tesseract') {
              setProgress(20);
              setProgressMessage('Initializing...');
            } else if (m.status === 'loading language traineddata') {
              setProgress(40);
              setProgressMessage('Loading language data...');
            } else if (m.status === 'initializing api') {
              setProgress(80);
              setProgressMessage('Almost ready...');
            }
          },
        });

        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });

        workerRef.current = worker;
        setStatus('ready');
        setProgress(100);
        setProgressMessage('Ready!');
      } catch (err) {
        setStatus('error');
        setError('Failed to initialize OCR engine');
        initPromiseRef.current = null;
        throw err;
      }
    })();

    return initPromiseRef.current;
  }, []);

  const preload = useCallback(async () => {
    await initializeWorker();
  }, [initializeWorker]);

  const processImage = useCallback(async (file: File): Promise<OCRResult | null> => {
    try {
      // Ensure worker is initialized
      await initializeWorker();

      if (!workerRef.current) {
        throw new Error('OCR engine not available');
      }

      setStatus('processing');
      setProgress(0);
      setProgressMessage('Enhancing image...');
      setError(null);

      // Preprocess image for better OCR (grayscale, contrast, threshold)
      let processedImage: string;
      try {
        processedImage = await preprocessImage(file);
      } catch {
        // Fallback to raw image if preprocessing fails
        processedImage = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      setProgress(30);
      setProgressMessage('Reading text...');

      const result = await workerRef.current.recognize(processedImage);
      
      setProgress(70);
      setProgressMessage('Extracting items...');

      const ocrText = result.data.text;
      const ocrConfidence = result.data.confidence / 100;

      // Log for debugging
      console.log('OCR Raw Text:', ocrText);
      console.log('OCR Confidence:', ocrConfidence);

      // Check confidence
      if (!isConfidenceAcceptable(ocrConfidence)) {
        setStatus('ready');
        setError(`Receipt quality too low (${Math.round(ocrConfidence * 100)}% confidence). Try a clearer, well-lit photo.`);
        return null;
      }

      // Parse the text
      const parseResult = parseReceiptText(ocrText, ocrConfidence);
      
      console.log('Parsed items:', parseResult.items);
      console.log('Parsed meta:', parseResult.receiptMeta);

      // Must have at least some items to be useful
      if (parseResult.items.length === 0) {
        setStatus('ready');
        // Show what we did find to help debug
        const total = parseResult.receiptMeta.total ?? 0;
        const foundTotal = total > 0 ? ` (Found total: $${total.toFixed(2)})` : '';
        setError(`Could not extract line items from receipt.${foundTotal} Try a clearer photo or use manual entry.`);
        return null;
      }

      setStatus('ready');
      setProgress(100);
      setProgressMessage('Done!');

      return parseResult;
    } catch (err) {
      setStatus('ready');
      setError(err instanceof Error ? err.message : 'Failed to process image');
      return null;
    }
  }, [initializeWorker]);

  return {
    status,
    progress,
    progressMessage,
    error,
    preload,
    processImage,
    isReady: status === 'ready',
  };
}
