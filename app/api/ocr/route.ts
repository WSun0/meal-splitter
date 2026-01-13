import { NextRequest, NextResponse } from 'next/server';
import { createWorker, PSM } from 'tesseract.js';
import { preprocessImageForOCR, validateImage } from '@/lib/utils/image-processing';
import { parseReceiptText, isConfidenceAcceptable } from '@/lib/utils/receipt-parser';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate image
    const isValid = await validateImage(buffer);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid image file. Please upload a valid JPG, PNG, or other image format.' },
        { status: 400 }
      );
    }

    // Preprocess image
    let processedBuffer: Buffer;
    try {
      const preprocessResult = await preprocessImageForOCR(buffer);
      processedBuffer = preprocessResult.processedBuffer;
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to preprocess image',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Run OCR with Tesseract.js
    let ocrText = '';
    let ocrConfidence = 0;

    try {
      const worker = await createWorker('eng');

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // Assume a single uniform block of text
      });

      const result = await worker.recognize(processedBuffer);
      ocrText = result.data.text;
      ocrConfidence = result.data.confidence / 100; // Convert to 0-1 scale

      await worker.terminate();
    } catch (error) {
      return NextResponse.json(
        {
          error: 'OCR processing failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Check confidence
    if (!isConfidenceAcceptable(ocrConfidence)) {
      return NextResponse.json(
        {
          error: 'Receipt too blurry or low resolution to parse reliably',
          suggestion: 'Try retaking the photo in better lighting, closer to the receipt, flat (no angles), and without glare.',
          confidence: ocrConfidence,
          rawText: ocrText,
        },
        { status: 422 }
      );
    }

    // Parse receipt text
    const parseResult = parseReceiptText(ocrText, ocrConfidence);

    // Check if we extracted any meaningful data
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

    return NextResponse.json({
      success: true,
      data: parseResult,
    });
  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
