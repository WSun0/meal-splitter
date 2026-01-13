'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createWorker, Worker, PSM } from 'tesseract.js';
import { parseReceiptText, isConfidenceAcceptable } from '@/lib/utils/receipt-parser';
import { OCRResult } from '@/lib/types/meal';

export type OCRStatus = 'idle' | 'initializing' | 'ready' | 'processing' | 'error';

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
      setProgressMessage('Processing image...');
      setError(null);

      // Convert file to data URL for Tesseract
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProgress(30);
      setProgressMessage('Analyzing receipt...');

      const result = await workerRef.current.recognize(imageData);
      
      setProgress(80);
      setProgressMessage('Extracting items...');

      const ocrText = result.data.text;
      const ocrConfidence = result.data.confidence / 100;

      // Check confidence
      if (!isConfidenceAcceptable(ocrConfidence)) {
        setStatus('ready');
        setError('Receipt too blurry or low quality. Try a clearer photo or use manual entry.');
        return null;
      }

      // Parse the text
      const parseResult = parseReceiptText(ocrText, ocrConfidence);

      // Check if we got meaningful data
      if (parseResult.items.length === 0 && parseResult.receiptMeta.total === 0) {
        setStatus('ready');
        setError('Could not extract receipt data. The format may not be recognized.');
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
