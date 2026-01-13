import { NextRequest, NextResponse } from 'next/server';
import { preprocessImageForOCR, validateImage } from '@/lib/utils/image-processing';
import { parseReceiptText, isConfidenceAcceptable } from '@/lib/utils/receipt-parser';
import { 
  checkRateLimit, 
  getClientIP, 
  getRateLimitHeaders 
} from '@/lib/utils/server-rate-limiter';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max

// ============================================
// SECURITY CONSTANTS
// ============================================
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_BASE64_LENGTH = 15 * 1024 * 1024; // ~11 MB raw after base64 encoding
const MAX_IMAGE_DIMENSION = 4096; // pixels
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

interface GoogleVisionResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string;
      boundingPoly: {
        vertices: Array<{ x: number; y: number }>;
      };
    }>;
    fullTextAnnotation?: {
      text: string;
    };
    error?: {
      code: number;
      message: string;
    };
  }>;
}

/**
 * Sanitize text for logging to prevent log injection attacks
 */
function sanitizeForLog(text: string): string {
  return text
    .replace(/[\n\r]/g, ' ') // Remove newlines
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable chars
    .substring(0, 200); // Limit length
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let clientIP = 'unknown';

  try {
    // ============================================
    // 1. RATE LIMITING (Server-side, per IP)
    // ============================================
    clientIP = await getClientIP();
    const rateLimitResult = await checkRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
      const errorMessage = rateLimitResult.limitType === 'ip'
        ? 'Monthly scan limit reached for your device. Limit resets in ~30 days.'
        : 'Monthly scan limit reached for this service. Please try again later.';

      return NextResponse.json(
        { 
          error: errorMessage,
          retryAfter: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // ============================================
    // 2. API KEY CHECK
    // ============================================
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      console.error('[OCR] API key not configured');
      return NextResponse.json(
        { error: 'OCR service not configured.' },
        { status: 500 }
      );
    }

    // ============================================
    // 3. REQUEST PARSING
    // ============================================
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request format. Expected multipart form data.' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // ============================================
    // 4. FILE SIZE VALIDATION
    // ============================================
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { 
          error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
          maxSize: MAX_FILE_SIZE_BYTES,
        },
        { status: 413 }
      );
    }

    // ============================================
    // 5. MIME TYPE VALIDATION
    // ============================================
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { 
          error: 'Invalid file type. Please upload a JPG, PNG, WebP, or HEIC image.',
          allowedTypes: Array.from(ALLOWED_MIME_TYPES),
        },
        { status: 415 }
      );
    }

    // ============================================
    // 6. CONVERT TO BUFFER & VALIDATE IMAGE
    // ============================================
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate image format using sharp (prevents malicious files)
    const isValid = await validateImage(buffer);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or corrupted image file. Please upload a valid image.' },
        { status: 400 }
      );
    }

    // ============================================
    // 7. PREPROCESS IMAGE
    // ============================================
    let processedBuffer: Buffer;
    try {
      const preprocessResult = await preprocessImageForOCR(buffer);
      
      // Check dimensions after processing
      if (preprocessResult.processedWidth > MAX_IMAGE_DIMENSION || 
          preprocessResult.processedHeight > MAX_IMAGE_DIMENSION) {
        return NextResponse.json(
          { error: `Image dimensions too large. Maximum ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels.` },
          { status: 413 }
        );
      }
      
      processedBuffer = preprocessResult.processedBuffer;
    } catch (error) {
      // Fall back to original image if preprocessing fails
      console.warn('[OCR] Preprocessing failed, using original image:', 
        error instanceof Error ? error.message : 'Unknown error');
      processedBuffer = buffer;
    }

    // ============================================
    // 8. BASE64 LENGTH CHECK
    // ============================================
    const base64Image = processedBuffer.toString('base64');
    
    if (base64Image.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { error: 'Processed image too large. Please use a smaller or lower resolution image.' },
        { status: 413 }
      );
    }

    // ============================================
    // 9. CALL GOOGLE CLOUD VISION API
    // ============================================
    let ocrText = '';
    let ocrConfidence = 0;

    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64Image },
                features: [
                  { type: 'TEXT_DETECTION', maxResults: 1 },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OCR] Google Vision API error:', sanitizeForLog(errorText));
        return NextResponse.json(
          {
            error: 'OCR service error',
            details: `Service returned status ${response.status}`,
          },
          { status: 500 }
        );
      }

      const result: GoogleVisionResponse = await response.json();
      
      // Check for API-level errors
      if (result.responses[0]?.error) {
        const apiError = result.responses[0].error;
        console.error('[OCR] Google Vision API error:', apiError.code, sanitizeForLog(apiError.message));
        return NextResponse.json(
          {
            error: 'OCR processing failed',
            details: 'The image could not be processed.',
          },
          { status: 500 }
        );
      }

      // Extract text from response
      const textAnnotations = result.responses[0]?.textAnnotations;
      const fullTextAnnotation = result.responses[0]?.fullTextAnnotation;

      if (fullTextAnnotation?.text) {
        ocrText = fullTextAnnotation.text;
      } else if (textAnnotations && textAnnotations.length > 0) {
        ocrText = textAnnotations[0].description;
      }

      // Estimate confidence based on text extraction
      ocrConfidence = ocrText.length > 20 ? 0.85 : ocrText.length > 0 ? 0.6 : 0;

    } catch (error) {
      console.error('[OCR] Network error:', error instanceof Error ? error.message : 'Unknown');
      return NextResponse.json(
        {
          error: 'OCR processing failed',
          details: 'Network error while processing image.',
        },
        { status: 500 }
      );
    }

    // ============================================
    // 10. VALIDATE OCR RESULTS
    // ============================================
    if (!ocrText || ocrText.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'No text detected in image',
          suggestion: 'Make sure the receipt is clearly visible and try again.',
          confidence: 0,
          rawText: '',
        },
        { status: 422 }
      );
    }

    // Log sanitized preview for debugging (no sensitive data)
    console.log('[OCR] Success:', {
      ip: clientIP,
      textLength: ocrText.length,
      confidence: ocrConfidence,
      duration: Date.now() - startTime,
    });

    // Check confidence
    if (!isConfidenceAcceptable(ocrConfidence)) {
      return NextResponse.json(
        {
          error: 'Receipt quality may be too low',
          suggestion: 'Try retaking the photo in better lighting, closer to the receipt.',
          confidence: ocrConfidence,
          rawText: ocrText,
        },
        { status: 422 }
      );
    }

    // ============================================
    // 11. PARSE RECEIPT & RETURN
    // ============================================
    const parseResult = parseReceiptText(ocrText, ocrConfidence);

    if (parseResult.items.length === 0 && parseResult.receiptMeta.total === 0) {
      return NextResponse.json(
        {
          error: 'Could not extract receipt data',
          suggestion: 'The receipt format may not be recognizable. Please try manual entry or a clearer photo.',
          confidence: ocrConfidence,
          rawText: ocrText,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: parseResult,
      },
      {
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );

  } catch (error) {
    console.error('[OCR] Unexpected error:', {
      ip: clientIP,
      error: error instanceof Error ? error.message : 'Unknown',
      duration: Date.now() - startTime,
    });
    
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: 'Please try again.',
      },
      { status: 500 }
    );
  }
}
