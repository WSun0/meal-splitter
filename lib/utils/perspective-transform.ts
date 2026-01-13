import PerspT from 'perspective-transform';

export interface Point {
  x: number;
  y: number;
}

export interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/**
 * Apply perspective transform to extract a quadrilateral region from an image
 * and warp it into a rectangle.
 * 
 * @param sourceCanvas - The source canvas with the original image
 * @param corners - The 4 corners of the region to extract (in clockwise order from top-left)
 * @param outputWidth - Optional output width (auto-calculated if not provided)
 * @param outputHeight - Optional output height (auto-calculated if not provided)
 * @returns A new canvas with the perspective-corrected image
 */
export function applyPerspectiveTransform(
  sourceCanvas: HTMLCanvasElement,
  corners: Corners,
  outputWidth?: number,
  outputHeight?: number
): HTMLCanvasElement {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;

  // Calculate output dimensions based on the quadrilateral if not provided
  const width = outputWidth ?? Math.max(
    Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
    Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y)
  );
  const height = outputHeight ?? Math.max(
    Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y),
    Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y)
  );

  // Source points (the quadrilateral corners)
  const srcPoints: [number, number, number, number, number, number, number, number] = [
    topLeft.x, topLeft.y,
    topRight.x, topRight.y,
    bottomRight.x, bottomRight.y,
    bottomLeft.x, bottomLeft.y,
  ];

  // Destination points (rectangle corners)
  const dstPoints: [number, number, number, number, number, number, number, number] = [
    0, 0,
    width, 0,
    width, height,
    0, height,
  ];

  // Create the perspective transform
  // Note: We need the inverse transform to map from destination to source
  const transform = PerspT(dstPoints, srcPoints);

  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = Math.round(width);
  outputCanvas.height = Math.round(height);
  const outputCtx = outputCanvas.getContext('2d');

  if (!outputCtx) {
    throw new Error('Could not get output canvas context');
  }

  // Get source image data
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) {
    throw new Error('Could not get source canvas context');
  }
  const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const srcPixels = sourceData.data;
  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;

  // Create output image data
  const outputData = outputCtx.createImageData(outputCanvas.width, outputCanvas.height);
  const dstPixels = outputData.data;
  const dstWidth = outputCanvas.width;
  const dstHeight = outputCanvas.height;

  // For each pixel in the output, find the corresponding source pixel
  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      // Transform destination point to source point
      const srcPoint = transform.transform(x, y);
      const srcX = srcPoint[0];
      const srcY = srcPoint[1];

      // Bilinear interpolation for smoother results
      const pixel = bilinearInterpolate(srcPixels, srcWidth, srcHeight, srcX, srcY);

      const dstIdx = (y * dstWidth + x) * 4;
      dstPixels[dstIdx] = pixel.r;
      dstPixels[dstIdx + 1] = pixel.g;
      dstPixels[dstIdx + 2] = pixel.b;
      dstPixels[dstIdx + 3] = pixel.a;
    }
  }

  outputCtx.putImageData(outputData, 0, 0);
  return outputCanvas;
}

/**
 * Bilinear interpolation for smooth pixel sampling
 */
function bilinearInterpolate(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): { r: number; g: number; b: number; a: number } {
  // Clamp to image bounds
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);

  const xWeight = x - x0;
  const yWeight = y - y0;

  // Get the 4 surrounding pixels
  const idx00 = (y0 * width + x0) * 4;
  const idx10 = (y0 * width + x1) * 4;
  const idx01 = (y1 * width + x0) * 4;
  const idx11 = (y1 * width + x1) * 4;

  // Interpolate each channel
  const interpolate = (c: number) => {
    const v00 = pixels[idx00 + c];
    const v10 = pixels[idx10 + c];
    const v01 = pixels[idx01 + c];
    const v11 = pixels[idx11 + c];

    const top = v00 * (1 - xWeight) + v10 * xWeight;
    const bottom = v01 * (1 - xWeight) + v11 * xWeight;
    return Math.round(top * (1 - yWeight) + bottom * yWeight);
  };

  return {
    r: interpolate(0),
    g: interpolate(1),
    b: interpolate(2),
    a: interpolate(3),
  };
}

/**
 * Calculate the area of a quadrilateral using the shoelace formula
 */
export function calculateQuadArea(corners: Corners): number {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;
  const points = [topLeft, topRight, bottomRight, bottomLeft];
  
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}
