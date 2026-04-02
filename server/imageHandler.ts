import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { mediaUploads } from "../drizzle/schema";

/**
 * Generate an AI image based on caption and niche context
 */
export async function generateAIImage(
  caption: string,
  niche: string,
  tone?: string
): Promise<{ url: string; success: boolean; error?: string }> {
  try {
    const nicheContext = getNicheImageContext(niche);
    const toneContext = tone ? ` Style: ${tone}.` : "";

    const prompt = `Create a professional, engaging social media image for the following post.${toneContext}

Post content: "${caption}"

Audience context: ${nicheContext}

Requirements:
- Visually appealing and on-brand
- Suitable for Instagram, Facebook, and TikTok
- Clear, readable text if any
- Professional quality
- Matches the tone and audience`;

    const result = await generateImage({ prompt });

    if (!result.url) {
      return { url: "", success: false, error: "Failed to generate image" };
    }

    return { url: result.url, success: true };
  } catch (error) {
    console.error("[ImageHandler] AI image generation failed:", error);
    return {
      url: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle file upload to S3
 */
export async function uploadMediaFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  userId: number
): Promise<{ url: string; success: boolean; error?: string }> {
  try {
    // Generate unique file key with user ID and timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileKey = `media/${userId}/${timestamp}-${randomSuffix}-${fileName}`;

    const result = await storagePut(fileKey, fileBuffer, mimeType);

    if (!result.url) {
      return { url: "", success: false, error: "Failed to upload file" };
    }

    // Log the upload in database
    const db = await getDb();
    if (db) {
      const fileType = mimeType.startsWith("video") ? "video" : "image";
      await db.insert(mediaUploads).values({
        userId,
        fileUrl: result.url,
        fileType: fileType as "image" | "video",
        fileName,
        fileSize: fileBuffer.length,
      });
    }

    return { url: result.url, success: true };
  } catch (error) {
    console.error("[ImageHandler] File upload failed:", error);
    return {
      url: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get niche-specific image context for AI generation
 */
function getNicheImageContext(niche: string): string {
  const contexts: Record<string, string> = {
    time_freedom:
      "Audience seeking work-life balance and freedom. Use inspiring, aspirational imagery with themes of travel, relaxation, and independence.",
    parents:
      "Busy parents managing work and family. Use warm, relatable, family-friendly imagery with themes of balance and support.",
    side_hustlers:
      "Entrepreneurs building side income. Use energetic, motivational imagery with themes of growth, hustle, and success.",
    online_business:
      "People learning to build online businesses. Use professional, educational imagery with themes of learning, growth, and opportunity.",
    cultural:
      "Culturally diverse audience. Use inclusive, diverse imagery celebrating different cultures and perspectives.",
    over_50:
      "Mature audience 50+. Use respectful, sophisticated imagery with themes of wisdom, experience, and vitality.",
    scam_survivors:
      "People who've been scammed building trust. Use honest, transparent, reassuring imagery with themes of safety and authenticity.",
  };

  return contexts[niche] || "Professional social media content";
}

/**
 * Validate uploaded file
 */
export function validateUploadedFile(
  fileBuffer: Buffer,
  mimeType: string,
  maxSizeBytes: number = 10 * 1024 * 1024 // 10MB default
): { valid: boolean; error?: string } {
  if (!fileBuffer || fileBuffer.length === 0) {
    return { valid: false, error: "File is empty" };
  }

  if (fileBuffer.length > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeBytes / 1024 / 1024}MB limit`,
    };
  }

  const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const validVideoTypes = ["video/mp4", "video/quicktime", "video/webm"];
  const allValidTypes = [...validImageTypes, ...validVideoTypes];

  if (!allValidTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Supported: images (JPEG, PNG, WebP, GIF) and videos (MP4, MOV, WebM)`,
    };
  }

  return { valid: true };
}
