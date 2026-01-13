/**
 * Adaptive thresholding for document enhancement
 * Makes whites whiter and blacks blacker by computing local thresholds
 */

export interface EnhancementOptions {
  /** Block size for local threshold calculation (must be odd). Default: 15 */
  blockSize?: number;
  /** Constant subtracted from the mean. Higher = more black. Default: 10 */
  constantC?: number;
  /** Whether to apply slight sharpening before thresholding. Default: true */
  sharpen?: boolean;
}

/**
 * Apply adaptive thresholding to make document text crisp
 * This is the "magic" filter effect from scanner apps
 * 
 * @param canvas - Source canvas with the image
 * @param options - Enhancement options
 * @returns New canvas with enhanced image
 */
export function applyAdaptiveThreshold(
  canvas: HTMLCanvasElement,
  options: EnhancementOptions = {}
): HTMLCanvasElement {
  const {
    blockSize = 15,
    constantC = 10,
    sharpen = true,
  } = options;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Step 1: Convert to grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i += 4) {
    const idx = i / 4;
    // Luminance formula
    gray[idx] = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
  }

  // Step 2: Optional sharpening (unsharp mask)
  const processed: Uint8Array = sharpen ? applySharpen(gray, width, height) : gray;

  // Step 3: Compute integral image for fast local mean calculation
  const integral = computeIntegralImage(processed, width, height);

  // Step 4: Apply adaptive threshold
  const halfBlock = Math.floor(blockSize / 2);
  const output = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Calculate the window bounds
      const x1 = Math.max(0, x - halfBlock);
      const y1 = Math.max(0, y - halfBlock);
      const x2 = Math.min(width - 1, x + halfBlock);
      const y2 = Math.min(height - 1, y + halfBlock);

      // Calculate local mean using integral image
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = getIntegralSum(integral, width, x1, y1, x2, y2);
      const mean = sum / area;

      // Threshold: if pixel is darker than local mean - C, it's black
      const idx = y * width + x;
      const threshold = mean - constantC;
      output[idx] = processed[idx] < threshold ? 0 : 255;
    }
  }

  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext('2d');
  if (!outputCtx) throw new Error('Could not get output canvas context');

  const outputData = outputCtx.createImageData(width, height);
  for (let i = 0; i < output.length; i++) {
    const pixelIdx = i * 4;
    outputData.data[pixelIdx] = output[i];
    outputData.data[pixelIdx + 1] = output[i];
    outputData.data[pixelIdx + 2] = output[i];
    outputData.data[pixelIdx + 3] = 255;
  }

  outputCtx.putImageData(outputData, 0, 0);
  return outputCanvas;
}

/**
 * Apply a simple grayscale enhancement without full binarization
 * Good for previewing before full threshold
 */
export function applyContrastEnhancement(
  canvas: HTMLCanvasElement,
  contrast: number = 1.5,
  brightness: number = 0
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext('2d');
  if (!outputCtx) throw new Error('Could not get output canvas context');

  const outputData = outputCtx.createImageData(width, height);

  for (let i = 0; i < pixels.length; i += 4) {
    // Convert to grayscale
    let gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    
    // Apply contrast and brightness
    gray = 128 + (gray - 128) * contrast + brightness;
    gray = Math.max(0, Math.min(255, gray));

    outputData.data[i] = gray;
    outputData.data[i + 1] = gray;
    outputData.data[i + 2] = gray;
    outputData.data[i + 3] = 255;
  }

  outputCtx.putImageData(outputData, 0, 0);
  return outputCanvas;
}

/**
 * Compute integral image for fast local sum queries
 */
function computeIntegralImage(gray: Uint8Array, width: number, height: number): Float64Array {
  const integral = new Float64Array((width + 1) * (height + 1));
  const integralWidth = width + 1;

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * integralWidth + (x + 1)] = 
        integral[y * integralWidth + (x + 1)] + rowSum;
    }
  }

  return integral;
}

/**
 * Get sum of rectangle from integral image
 */
function getIntegralSum(
  integral: Float64Array,
  width: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const integralWidth = width + 1;
  
  // Shift coordinates for integral image (which has 1-pixel padding)
  const a = integral[y1 * integralWidth + x1];
  const b = integral[y1 * integralWidth + (x2 + 1)];
  const c = integral[(y2 + 1) * integralWidth + x1];
  const d = integral[(y2 + 1) * integralWidth + (x2 + 1)];

  return d - b - c + a;
}

/**
 * Apply simple sharpening using unsharp mask
 */
function applySharpen(gray: Uint8Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(width * height);
  const amount = 0.5; // Sharpening amount

  // Simple 3x3 blur kernel for unsharp mask
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        output[idx] = gray[idx];
        continue;
      }

      // Calculate local blur (3x3 average)
      let blur = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          blur += gray[(y + dy) * width + (x + dx)];
        }
      }
      blur /= 9;

      // Unsharp mask: original + amount * (original - blur)
      const sharpened = gray[idx] + amount * (gray[idx] - blur);
      output[idx] = Math.max(0, Math.min(255, Math.round(sharpened)));
    }
  }

  return output;
}
