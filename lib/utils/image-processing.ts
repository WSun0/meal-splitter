import sharp from 'sharp';

export interface PreprocessingResult {
  processedBuffer: Buffer;
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
}

/**
 * Preprocess an image for better OCR results
 * Applies: grayscale, contrast enhancement, sharpening, noise reduction
 */
export async function preprocessImageForOCR(
  imageBuffer: Buffer
): Promise<PreprocessingResult> {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Step 1: Convert to grayscale
    let processed = image.grayscale();

    // Step 2: Resize if too large (max 2000px on longest side for performance)
    const maxDimension = 2000;
    if (metadata.width && metadata.height) {
      const needsResize =
        metadata.width > maxDimension || metadata.height > maxDimension;
      if (needsResize) {
        processed = processed.resize({
          width: metadata.width > maxDimension ? maxDimension : undefined,
          height: metadata.height > maxDimension ? maxDimension : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
    }

    // Step 3: Normalize (auto-level)
    processed = processed.normalize();

    // Step 4: Increase contrast
    processed = processed.linear(1.5, -(128 * 0.5));

    // Step 5: Sharpen
    processed = processed.sharpen({ sigma: 1.0 });

    // Step 6: Apply threshold for binarization
    // This makes text darker and background whiter
    processed = processed.threshold(128, { grayscale: false });

    const processedBuffer = await processed.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    return {
      processedBuffer,
      originalWidth: metadata.width || 0,
      originalHeight: metadata.height || 0,
      processedWidth: processedMetadata.width || 0,
      processedHeight: processedMetadata.height || 0,
    };
  } catch (error) {
    throw new Error(
      `Image preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate if an image buffer is valid and readable
 */
export async function validateImage(imageBuffer: Buffer): Promise<boolean> {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    return !!(metadata.width && metadata.height && metadata.format);
  } catch {
    return false;
  }
}
