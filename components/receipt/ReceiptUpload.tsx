'use client';

import { useState, useRef, useCallback } from 'react';
import { useMeal } from '@/lib/store/meal-store';
import { OCRResult } from '@/lib/types/meal';
import { OCRStatus } from '@/lib/hooks/useClientOCR';
import { UsageStats } from '@/lib/utils/rate-limiter';
import ImagePreprocessor from './ImagePreprocessor';

interface OCRHook {
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

interface ReceiptUploadProps {
  onParseSuccess: (result: OCRResult) => void;
  ocr: OCRHook;
}

type UploadStep = 'upload' | 'preprocess' | 'processing';

export default function ReceiptUpload({ onParseSuccess, ocr }: ReceiptUploadProps) {
  const { meal } = useMeal();
  const [step, setStep] = useState<UploadStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessing = ocr.status === 'processing' || step === 'processing';
  const isInitializing = ocr.status === 'initializing';
  const error = localError || ocr.error;

  // Handle initial file selection - show preprocessor
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setLocalError('Please upload an image file (JPG, PNG, HEIC, etc.)');
      return;
    }

    setLocalError(null);
    setSelectedFile(file);
    setStep('preprocess');
  }, []);

  // Handle preprocessor completion - run OCR on processed image
  const handlePreprocessComplete = useCallback(async (processedImageDataUrl: string) => {
    setStep('processing');
    setLocalError(null);

    try {
      // Use the new processImageFromDataUrl if available, otherwise convert to blob
      let result: OCRResult | null = null;
      
      if (ocr.processImageFromDataUrl) {
        result = await ocr.processImageFromDataUrl(processedImageDataUrl);
      } else {
        // Fallback: convert data URL to File
        const response = await fetch(processedImageDataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'processed-receipt.png', { type: 'image/png' });
        result = await ocr.processImage(file);
      }

      if (result) {
        onParseSuccess(result);
      } else {
        setStep('upload');
      }
    } catch (err) {
      console.error('OCR processing failed:', err);
      setLocalError('Failed to process image. Please try again.');
      setStep('upload');
    }
  }, [ocr, onParseSuccess]);

  // Cancel preprocessing and go back to upload
  const handlePreprocessCancel = useCallback(() => {
    setSelectedFile(null);
    setStep('upload');
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleClick = () => fileInputRef.current?.click();

  if (!meal) return null;

  // Show preprocessor if a file is selected and we're in preprocess step
  if (step === 'preprocess' && selectedFile) {
    return (
      <ImagePreprocessor
        imageFile={selectedFile}
        onComplete={handlePreprocessComplete}
        onCancel={handlePreprocessCancel}
      />
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Upload Receipt</h2>
          <p className="text-sm text-stone-500">We'll help you crop and enhance it</p>
        </div>
      </div>

      {/* Initializing state - shown while OCR engine loads */}
      {isInitializing && (
        <div className="rounded-2xl p-8 text-center bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200">
          <div className="space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-primary-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <div>
              <p className="font-semibold text-primary-700">{ocr.progressMessage || 'Preparing scanner...'}</p>
              <p className="text-sm text-primary-600 mt-1">One-time setup, please wait</p>
              <div className="mt-3 w-48 mx-auto bg-primary-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-primary-500 transition-all duration-300 ease-out"
                  style={{ width: `${ocr.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main upload area - shown when ready or idle */}
      {!isInitializing && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          className={`
            relative rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
            ${isDragging 
              ? 'bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-400 scale-[1.02]' 
              : 'bg-stone-50 border-2 border-dashed border-stone-200 hover:border-primary-300 hover:bg-primary-50/30'
            }
            ${isProcessing ? 'opacity-60 cursor-wait pointer-events-none' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isProcessing}
          />

          {isProcessing ? (
            <div className="space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-stone-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
              </div>
              <div>
                <p className="font-semibold text-stone-700">{ocr.progressMessage || 'Processing receipt...'}</p>
                <p className="text-sm text-stone-500 mt-1">Analyzing your receipt</p>
                <div className="mt-3 w-48 mx-auto bg-stone-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-primary-500 transition-all duration-300 ease-out"
                    style={{ width: `${ocr.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-white border border-stone-200 flex items-center justify-center mx-auto shadow-sm">
                <svg className="w-10 h-10 text-stone-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-stone-600">
                  <span className="font-semibold text-primary-600">Click to upload</span>
                  <span className="text-stone-500"> or drag and drop</span>
                </p>
                <p className="text-sm text-stone-400 mt-2">JPG, PNG, or HEIC (max 10MB)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-5 p-4 bg-red-50 border border-red-100 rounded-2xl">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-red-800 font-medium">{error}</p>
              <p className="text-red-600 text-sm mt-1">Try a clearer photo or use manual entry.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 p-4 bg-gradient-to-br from-secondary-50 to-secondary-100/50 rounded-2xl">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-secondary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-secondary-800 mb-1">New: Smart cropping</p>
            <ul className="text-sm text-secondary-700 space-y-1">
              <li>• Upload any photo of a receipt</li>
              <li>• Drag corners to crop precisely</li>
              <li>• Auto-enhance for better parsing</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Usage indicator */}
      <div className={`mt-4 p-3 rounded-xl flex items-center justify-between ${
        ocr.usageStats.isAtLimit 
          ? 'bg-red-50 border border-red-200' 
          : ocr.usageStats.isNearLimit 
            ? 'bg-amber-50 border border-amber-200' 
            : 'bg-stone-50 border border-stone-200'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            ocr.usageStats.isAtLimit 
              ? 'bg-red-500' 
              : ocr.usageStats.isNearLimit 
                ? 'bg-amber-500' 
                : 'bg-green-500'
          }`} />
          <span className={`text-sm ${
            ocr.usageStats.isAtLimit 
              ? 'text-red-700' 
              : ocr.usageStats.isNearLimit 
                ? 'text-amber-700' 
                : 'text-stone-600'
          }`}>
            {ocr.usageMessage}
          </span>
        </div>
        <div className="text-xs text-stone-500">
          {ocr.usageStats.remaining} remaining
        </div>
      </div>

      {/* Rate limit warning */}
      {ocr.usageStats.isAtLimit && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-red-800 font-medium">Monthly scan limit reached</p>
              <p className="text-red-600 text-sm mt-1">
                Please use manual entry to add your receipt items. The limit resets on {ocr.usageStats.resetDate}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
