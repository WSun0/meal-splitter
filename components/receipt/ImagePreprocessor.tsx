'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { applyPerspectiveTransform, Corners, Point } from '@/lib/utils/perspective-transform';
import { applyAdaptiveThreshold, EnhancementOptions } from '@/lib/utils/adaptive-threshold';

type PreprocessorStep = 'crop' | 'processing' | 'preview';

interface ImagePreprocessorProps {
  imageFile: File;
  onComplete: (processedImageDataUrl: string) => void;
  onCancel: () => void;
}

const HANDLE_RADIUS = 16;
const HANDLE_TOUCH_RADIUS = 24;

export default function ImagePreprocessor({
  imageFile,
  onComplete,
  onCancel,
}: ImagePreprocessorProps) {
  const [step, setStep] = useState<PreprocessorStep>('crop');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [corners, setCorners] = useState<Corners | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<keyof Corners | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [enhancementOptions, setEnhancementOptions] = useState<EnhancementOptions>({
    blockSize: 15,
    constantC: 10,
    sharpen: true,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scale factor for display (image might be larger than canvas)
  const [scale, setScale] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load image when file changes
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      
      // Calculate canvas size to fit container while maintaining aspect ratio
      const maxWidth = Math.min(600, window.innerWidth - 48);
      const maxHeight = Math.min(500, window.innerHeight - 300);
      
      let displayWidth = img.width;
      let displayHeight = img.height;
      
      if (displayWidth > maxWidth) {
        displayHeight = (displayHeight / displayWidth) * maxWidth;
        displayWidth = maxWidth;
      }
      if (displayHeight > maxHeight) {
        displayWidth = (displayWidth / displayHeight) * maxHeight;
        displayHeight = maxHeight;
      }

      const newScale = displayWidth / img.width;
      setScale(newScale);
      setCanvasSize({ width: displayWidth, height: displayHeight });

      // Initialize corners at image edges with some padding
      const padding = 20;
      setCorners({
        topLeft: { x: padding, y: padding },
        topRight: { x: displayWidth - padding, y: padding },
        bottomRight: { x: displayWidth - padding, y: displayHeight - padding },
        bottomLeft: { x: padding, y: displayHeight - padding },
      });

      setImageLoaded(true);
    };

    img.onerror = () => {
      console.error('Failed to load image');
    };

    // Load from file
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result as string;
    };
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  // Draw the image and corner handles
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current || !corners) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Draw the image
    ctx.drawImage(imageRef.current, 0, 0, canvasSize.width, canvasSize.height);

    // Draw semi-transparent overlay outside the crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Cut out the crop area
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(corners.topLeft.x, corners.topLeft.y);
    ctx.lineTo(corners.topRight.x, corners.topRight.y);
    ctx.lineTo(corners.bottomRight.x, corners.bottomRight.y);
    ctx.lineTo(corners.bottomLeft.x, corners.bottomLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Re-draw the image in the crop area (so it's not darkened)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners.topLeft.x, corners.topLeft.y);
    ctx.lineTo(corners.topRight.x, corners.topRight.y);
    ctx.lineTo(corners.bottomRight.x, corners.bottomRight.y);
    ctx.lineTo(corners.bottomLeft.x, corners.bottomLeft.y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(imageRef.current, 0, 0, canvasSize.width, canvasSize.height);
    ctx.restore();

    // Draw crop lines
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(corners.topLeft.x, corners.topLeft.y);
    ctx.lineTo(corners.topRight.x, corners.topRight.y);
    ctx.lineTo(corners.bottomRight.x, corners.bottomRight.y);
    ctx.lineTo(corners.bottomLeft.x, corners.bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    // Draw corner handles
    const cornerKeys: (keyof Corners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    cornerKeys.forEach((key) => {
      const point = corners[key];
      
      // Outer circle (white)
      ctx.beginPath();
      ctx.arc(point.x, point.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner circle
      ctx.beginPath();
      ctx.arc(point.x, point.y, HANDLE_RADIUS - 6, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
    });
  }, [imageLoaded, corners, canvasSize]);

  // Get position from mouse or touch event
  const getEventPosition = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  // Find which corner is being touched
  const findCornerAtPosition = useCallback((pos: Point): keyof Corners | null => {
    if (!corners) return null;

    const cornerKeys: (keyof Corners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    for (const key of cornerKeys) {
      const corner = corners[key];
      const distance = Math.hypot(pos.x - corner.x, pos.y - corner.y);
      if (distance <= HANDLE_TOUCH_RADIUS) {
        return key;
      }
    }
    return null;
  }, [corners]);

  // Mouse/touch handlers
  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getEventPosition(e);
    const corner = findCornerAtPosition(pos);
    if (corner) {
      setDraggingCorner(corner);
      e.preventDefault();
    }
  }, [getEventPosition, findCornerAtPosition]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingCorner || !corners) return;

    const pos = getEventPosition(e);
    
    // Clamp to canvas bounds
    const clampedX = Math.max(HANDLE_RADIUS, Math.min(canvasSize.width - HANDLE_RADIUS, pos.x));
    const clampedY = Math.max(HANDLE_RADIUS, Math.min(canvasSize.height - HANDLE_RADIUS, pos.y));

    setCorners({
      ...corners,
      [draggingCorner]: { x: clampedX, y: clampedY },
    });

    e.preventDefault();
  }, [draggingCorner, corners, canvasSize, getEventPosition]);

  const handlePointerUp = useCallback(() => {
    setDraggingCorner(null);
  }, []);

  // Process the image
  const handleProcess = useCallback(async () => {
    if (!imageRef.current || !corners) return;

    setStep('processing');

    // Small delay to let UI update
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // Create a full-resolution canvas with the original image
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = imageRef.current.width;
      fullCanvas.height = imageRef.current.height;
      const fullCtx = fullCanvas.getContext('2d');
      if (!fullCtx) throw new Error('Could not get canvas context');
      fullCtx.drawImage(imageRef.current, 0, 0);

      // Scale corners back to original image coordinates
      const scaledCorners: Corners = {
        topLeft: { x: corners.topLeft.x / scale, y: corners.topLeft.y / scale },
        topRight: { x: corners.topRight.x / scale, y: corners.topRight.y / scale },
        bottomRight: { x: corners.bottomRight.x / scale, y: corners.bottomRight.y / scale },
        bottomLeft: { x: corners.bottomLeft.x / scale, y: corners.bottomLeft.y / scale },
      };

      // Apply perspective transform
      const warpedCanvas = applyPerspectiveTransform(fullCanvas, scaledCorners);

      // Apply adaptive threshold
      const enhancedCanvas = applyAdaptiveThreshold(warpedCanvas, enhancementOptions);

      // Convert to data URL
      const dataUrl = enhancedCanvas.toDataURL('image/png');
      setProcessedImageUrl(dataUrl);
      setStep('preview');
    } catch (error) {
      console.error('Processing failed:', error);
      setStep('crop');
    }
  }, [corners, scale, enhancementOptions]);

  // Accept the processed image
  const handleAccept = useCallback(() => {
    if (processedImageUrl) {
      onComplete(processedImageUrl);
    }
  }, [processedImageUrl, onComplete]);

  // Go back to crop step
  const handleRetry = useCallback(() => {
    setProcessedImageUrl(null);
    setStep('crop');
  }, []);

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">
            {step === 'crop' && 'Crop Receipt'}
            {step === 'processing' && 'Processing...'}
            {step === 'preview' && 'Preview'}
          </h2>
          <p className="text-sm text-stone-500">
            {step === 'crop' && 'Drag corners to match receipt edges'}
            {step === 'processing' && 'Enhancing image quality'}
            {step === 'preview' && 'Review the processed image'}
          </p>
        </div>
      </div>

      {/* Crop Step */}
      {step === 'crop' && (
        <>
          <div 
            ref={containerRef}
            className="relative flex justify-center mb-6 bg-stone-100 rounded-xl p-4"
          >
            {!imageLoaded && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className={`rounded-lg ${imageLoaded ? 'cursor-move' : 'hidden'}`}
              style={{ touchAction: 'none' }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          </div>

          {/* Enhancement options */}
          <div className="mb-6 p-4 bg-stone-50 rounded-xl">
            <p className="text-sm font-medium text-stone-700 mb-3">Enhancement Settings</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-500 block mb-1">
                  Text Darkness: {enhancementOptions.constantC}
                </label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={enhancementOptions.constantC}
                  onChange={(e) => setEnhancementOptions({
                    ...enhancementOptions,
                    constantC: parseInt(e.target.value),
                  })}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-stone-400 mt-1">
                  <span>Lighter</span>
                  <span>Darker</span>
                </div>
              </div>
            </div>
            {/* Info box */}
            <div className="mt-4 p-3 bg-stone-100 rounded-lg border border-stone-200">
              <div className="flex gap-2">
                <svg className="w-4 h-4 text-stone-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-stone-600">
                  <span className="font-medium">Tip:</span> Slide right if text looks faint or broken. Slide left if there's too much black noise or speckles.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 text-stone-600 bg-stone-100 rounded-xl font-medium hover:bg-stone-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleProcess}
              disabled={!imageLoaded}
              className="flex-1 px-4 py-3 text-white bg-emerald-500 rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Process Image
            </button>
          </div>
        </>
      )}

      {/* Processing Step */}
      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-stone-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-stone-600 font-medium">Enhancing image...</p>
          <p className="text-sm text-stone-400 mt-1">This may take a moment</p>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && processedImageUrl && (
        <>
          <div className="relative flex justify-center mb-6 bg-stone-100 rounded-xl p-4">
            <img
              src={processedImageUrl}
              alt="Processed receipt"
              className="max-w-full max-h-[400px] rounded-lg shadow-md"
            />
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-800">Image enhanced</p>
                <p className="text-sm text-emerald-600">Text should be clearer for parsing</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 px-4 py-3 text-stone-600 bg-stone-100 rounded-xl font-medium hover:bg-stone-200 transition-colors"
            >
              Adjust Corners
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 px-4 py-3 text-white bg-emerald-500 rounded-xl font-medium hover:bg-emerald-600 transition-colors"
            >
              Use This Image
            </button>
          </div>
        </>
      )}
    </div>
  );
}
