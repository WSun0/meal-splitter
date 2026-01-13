'use client';

import { useState, useCallback } from 'react';
import { OCRResult } from '@/lib/types/meal';
import { 
  canUseOCR, 
  incrementUsage, 
  getUsageStats, 
  getUsageMessage,
  UsageStats,
  setServerRateLimited,
} from '@/lib/utils/rate-limiter';

export type OCRStatus = 'idle' | 'initializing' | 'ready' | 'processing' | 'error';

interface UseClientOCRReturn {
  status: OCRStatus;
  progress: number;
  progressMessage: string;
  error: string | null;
  preload: () => Promise<void>;
  processImage: (file: File) => Promise<OCRResult | null>;
  processImageFromDataUrl: (dataUrl: string) => Promise<OCRResult | null>;
  isReady: boolean;
  usageStats: UsageStats;
  usageMessage: string;
}

export function useClientOCR(): UseClientOCRReturn {
  const [status, setStatus] = useState<OCRStatus>('ready'); // No initialization needed for server API
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats>(getUsageStats());

  // Refresh usage stats
  const refreshUsageStats = useCallback(() => {
    setUsageStats(getUsageStats());
  }, []);

  // Preload is now a no-op since we use server API
  const preload = useCallback(async () => {
    refreshUsageStats();
  }, [refreshUsageStats]);

  // Core OCR processing via server API
  const runOCR = useCallback(async (imageData: string | File): Promise<OCRResult | null> => {
    // Check client-side rate limit first (quick fail for UX)
    if (!canUseOCR()) {
      setError(getUsageMessage());
      return null;
    }

    setProgress(10);
    setProgressMessage('Uploading image...');

    try {
      // Prepare form data
      const formData = new FormData();
      
      if (typeof imageData === 'string') {
        // Convert data URL to blob
        const response = await fetch(imageData);
        const blob = await response.blob();
        formData.append('file', blob, 'receipt.png');
      } else {
        formData.append('file', imageData);
      }

      setProgress(30);
      setProgressMessage('Analyzing receipt...');

      // Call server API
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      setProgress(70);
      setProgressMessage('Extracting items...');

      const result = await response.json();

      // Handle rate limiting from server
      if (response.status === 429) {
        const retryAfter = result.retryAfter || 60;
        setServerRateLimited(retryAfter);
        setError(result.error || `Rate limited. Please try again in ${retryAfter} seconds.`);
        refreshUsageStats();
        return null;
      }

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 422) {
          setError(result.error || 'Could not read receipt. Try a clearer photo or manual entry.');
          if (result.rawText) {
            console.log('OCR Raw Text (for debugging):', result.rawText);
          }
        } else if (response.status === 413) {
          setError(result.error || 'Image too large. Please use a smaller image.');
        } else if (response.status === 415) {
          setError(result.error || 'Invalid file type. Please upload JPG, PNG, or WebP.');
        } else {
          setError(result.error || 'Failed to process receipt');
        }
        return null;
      }

      // Success! Increment local usage counter for UX display
      incrementUsage();
      refreshUsageStats();

      setProgress(100);
      setProgressMessage('Done!');

      return result.data as OCRResult;
    } catch (err) {
      console.error('OCR API error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process image');
      return null;
    }
  }, [refreshUsageStats]);

  const processImage = useCallback(async (file: File): Promise<OCRResult | null> => {
    // Check rate limit
    if (!canUseOCR()) {
      setError(getUsageMessage());
      return null;
    }

    setStatus('processing');
    setProgress(0);
    setProgressMessage('Preparing image...');
    setError(null);

    try {
      const result = await runOCR(file);
      setStatus('ready');
      return result;
    } catch (err) {
      setStatus('ready');
      setError(err instanceof Error ? err.message : 'Failed to process image');
      return null;
    }
  }, [runOCR]);

  // Process an already-preprocessed image from a data URL
  const processImageFromDataUrl = useCallback(async (dataUrl: string): Promise<OCRResult | null> => {
    // Check rate limit
    if (!canUseOCR()) {
      setError(getUsageMessage());
      return null;
    }

    setStatus('processing');
    setProgress(0);
    setProgressMessage('Processing enhanced image...');
    setError(null);

    try {
      const result = await runOCR(dataUrl);
      setStatus('ready');
      return result;
    } catch (err) {
      setStatus('ready');
      setError(err instanceof Error ? err.message : 'Failed to process image');
      return null;
    }
  }, [runOCR]);

  return {
    status,
    progress,
    progressMessage,
    error,
    preload,
    processImage,
    processImageFromDataUrl,
    isReady: status === 'ready',
    usageStats,
    usageMessage: getUsageMessage(),
  };
}
