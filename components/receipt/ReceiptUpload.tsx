'use client';

import { useState, useRef } from 'react';
import { useMeal } from '@/lib/store/meal-store';
import { OCRResult } from '@/lib/types/meal';

interface ReceiptUploadProps {
  onParseSuccess: (result: OCRResult) => void;
}

export default function ReceiptUpload({ onParseSuccess }: ReceiptUploadProps) {
  const { meal } = useMeal();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, HEIC, etc.)');
      return;
    }

    setError(null);
    setSuggestion(null);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to process receipt');
        if (result.suggestion) {
          setSuggestion(result.suggestion);
        }
        return;
      }

      if (result.success && result.data) {
        onParseSuccess(result.data);
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

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
          <p className="text-sm text-stone-500">We'll extract items automatically</p>
        </div>
      </div>

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
              <p className="font-semibold text-stone-700">Processing receipt...</p>
              <p className="text-sm text-stone-500 mt-1">This may take a moment</p>
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
              {suggestion && <p className="text-red-600 text-sm mt-1">{suggestion}</p>}
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
            <p className="text-sm font-semibold text-secondary-800 mb-1">Tips for best results</p>
            <ul className="text-sm text-secondary-700 space-y-1">
              <li>• Good lighting, no shadows</li>
              <li>• Flat, no angles</li>
              <li>• Clear, in-focus text</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
