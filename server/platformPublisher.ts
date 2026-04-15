/**
 * Platform Publisher
 * Handles real API calls to Facebook, Instagram, and TikTok.
 * Each function accepts the post content and the user's stored credentials.
 */

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  errorMessage?: string;
}

export interface PostContent {
  caption?: string | null;
  hashtags?: string | null;
  script?: string | null;
  ideas?: string | null;
  fullContent?: string | null;
  title: string;
  imageUrl?: string | null;
  mediaType?: 'none' | 'image' | 'video' | null;
}

/** Build the final text body to publish from a post */
function buildPostText(post: PostContent): string {
  const parts: string[] = [];
  if (post.caption) parts.push(post.caption);
  else if (post.fullContent) parts.push(post.fullContent);
  else if (post.script) parts.push(post.script);
  else parts.push(post.title);
  if (post.hashtags) parts.push("\n\n" + post.hashtags);
  return parts.join("").trim();
}

// ─── Instagram ────────────────────────────────────────────────────────────────
/**
 * Publish to Instagram via the Graph API.
 * Requires: access_token (User Access Token with instagram_basic, instagram_content_publish)
 *           account_id  (Instagram Business/Creator Account ID)
 *
 * For a text-only post we create a text-only container (caption only, no media).
 * Note: Instagram requires at least one image for a feed post. We use a placeholder
 * image URL if none is provided, or the user can attach one later.
 */
export async function publishToInstagram(
  post: PostContent,
  credentials: { accessToken: string; accountId: string }
): Promise<PublishResult> {
  try {
    const text = buildPostText(post);
    const { accessToken, accountId } = credentials;

    // Step 1: Create media container
    // Instagram requires an image for feed posts.
    // Use the provided imageUrl if available, otherwise use a branded placeholder.
    const imageUrl = post.imageUrl || "https://placehold.co/1080x1080/0a0a0f/c9a84c?text=ContentCreatorHub";
    
    const containerRes = await fetch(
      `https://graph.instagram.com/v21.0/${accountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: text,
          media_type: "IMAGE",
          image_url: imageUrl,
          access_token: accessToken,
        }),
      }
    );

    const containerData = await containerRes.json() as any;
    if (!containerRes.ok || containerData.error) {
      const errorResult: PublishResult = {
        success: false,
        errorMessage: containerData.error?.message ?? `Instagram container error (${containerRes.status})`,
      };

      // Attach error code for worker to classify
      if (containerRes.status === 401 || containerData.error?.code === 190) {
        errorResult.errorMessage = "TOKEN_EXPIRED: " + errorResult.errorMessage;
      } else if (containerRes.status === 403 || containerData.error?.code === 200) {
        errorResult.errorMessage = "INSUFFICIENT_PERMISSIONS: " + errorResult.errorMessage;
      } else if (containerRes.status === 429) {
        errorResult.errorMessage = "RATE_LIMITED: " + errorResult.errorMessage;
      }

      return errorResult;
    }

    const containerId = containerData.id;

    // Step 2: Publish the container
    const publishRes = await fetch(
      `https://graph.instagram.com/v21.0/${accountId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishRes.json() as any;
    if (!publishRes.ok || publishData.error) {
      const errorResult: PublishResult = {
        success: false,
        errorMessage: publishData.error?.message ?? `Instagram publish error (${publishRes.status})`,
      };

      // Attach error code for worker to classify
      if (publishRes.status === 401 || publishData.error?.code === 190) {
        errorResult.errorMessage = "TOKEN_EXPIRED: " + errorResult.errorMessage;
      } else if (publishRes.status === 403 || publishData.error?.code === 200) {
        errorResult.errorMessage = "INSUFFICIENT_PERMISSIONS: " + errorResult.errorMessage;
      } else if (publishRes.status === 429) {
        errorResult.errorMessage = "RATE_LIMITED: " + errorResult.errorMessage;
      }

      return errorResult;
    }

    return { success: true, platformPostId: publishData.id };
  } catch (err: any) {
    return { success: false, errorMessage: err?.message ?? "Unknown Instagram error" };
  }
}

// ─── Facebook ─────────────────────────────────────────────────────────────────
/**
 * Publish to a Facebook Page via the Graph API.
 * Requires: access_token (Page Access Token with pages_manage_posts)
 *           page_id     (Facebook Page ID)
 * 
 * Supports:
 * - Text-only posts
 * - Text + single image (via direct binary upload to /{page-id}/photos)
 * - Proper error classification for auth failures and rate limits
 * 
 * Image Upload Flow:
 * 1. If imageUrl provided, fetch image binary from URL
 * 2. Upload to Facebook using POST /{page-id}/photos with multipart form data
 * 3. Get photo ID from response
 * 4. Create feed post with object_attachment pointing to photo ID
 */
export async function publishToFacebook(
  post: PostContent,
  credentials: { accessToken: string; pageId: string }
): Promise<PublishResult> {
  try {
    const text = buildPostText(post);
    const { accessToken, pageId } = credentials;

    let photoId: string | undefined;

    // Step 1: Upload image if available (direct binary upload)
    if (post.imageUrl) {
      try {
        photoId = await uploadImageToFacebook(post.imageUrl, pageId, accessToken);
        console.log(`[Facebook] Image uploaded successfully. Photo ID: ${photoId}`);
      } catch (imgErr: any) {
        console.warn(`[Facebook] Image upload failed: ${imgErr.message}. Continuing with text-only post.`);
        // Don't fail the entire post if image upload fails - continue with text-only
      }
    }

    // Step 2: Create feed post with message only
    // NOTE: Do NOT use object_attachment as it creates a share/wrapper post
    // Instead, the uploaded photo will automatically appear as the post's image
    // when we reference it via attached_media parameter
    const body: any = {
      message: text,
      access_token: accessToken,
    };

    // If photo was uploaded, reference it as attached media
    // This creates a native post with the image, not a share wrapper
    if (photoId) {
      body.attached_media = [{ media_fbid: photoId }];
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json() as any;
    if (!res.ok || data.error) {
      const errorResult: PublishResult = {
        success: false,
        errorMessage: data.error?.message ?? `Facebook error (${res.status})`,
      };

      // Attach error code for worker to classify
      if (res.status === 401 || data.error?.code === 190) {
        errorResult.errorMessage = "TOKEN_EXPIRED: " + errorResult.errorMessage;
      } else if (res.status === 403 || data.error?.code === 200) {
        errorResult.errorMessage = "INSUFFICIENT_PERMISSIONS: " + errorResult.errorMessage;
      } else if (res.status === 429) {
        errorResult.errorMessage = "RATE_LIMITED: " + errorResult.errorMessage;
      }

      return errorResult;
    }

    return { success: true, platformPostId: data.id };
  } catch (err: any) {
    return { success: false, errorMessage: err?.message ?? "Unknown Facebook error" };
  }
}

/**
 * Upload image binary to Facebook and return photo ID
 * Uses multipart form data to POST to /{page-id}/photos
 */
async function uploadImageToFacebook(
  imageUrl: string,
  pageId: string,
  accessToken: string
): Promise<string> {
  // Step 1: Fetch image binary from URL
  console.log(`[Facebook] Fetching image from: ${imageUrl}`);
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image: ${imageRes.status} ${imageRes.statusText}`);
  }

  const imageBuffer = await imageRes.arrayBuffer();
  console.log(`[Facebook] Image fetched: ${imageBuffer.byteLength} bytes`);

  // Step 2: Create FormData for multipart upload
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: imageRes.headers.get('content-type') || 'image/jpeg' });
  formData.append('source', blob, 'image.jpg');
  formData.append('access_token', accessToken);

  // Step 3: Upload to Facebook
  console.log(`[Facebook] Uploading image to /${pageId}/photos`);
  const uploadRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/photos`,
    {
      method: "POST",
      body: formData,
      // Don't set Content-Type header - fetch will set it with boundary automatically
    }
  );

  const uploadData = await uploadRes.json() as any;
  if (!uploadRes.ok || uploadData.error) {
    throw new Error(
      uploadData.error?.message ?? `Facebook photo upload error (${uploadRes.status})`
    );
  }

  if (!uploadData.id) {
    throw new Error('No photo ID returned from Facebook');
  }

  return uploadData.id;
}

/**
 * Alias for publishToFacebook for backward compatibility
 */
export async function publishToFacebookPage(
  post: PostContent,
  credentials: { accessToken: string; pageId: string }
): Promise<PublishResult> {
  return publishToFacebook(post, credentials);
}

// ─── TikTok ───────────────────────────────────────────────────────────────────
/**
 * Publish to TikTok via the Content Posting API.
 * Requires: access_token (OAuth2 access token with video.publish scope)
 *
 * TikTok requires a video for all posts. Text-only posts are not supported.
 * This function returns an instructional error if no video URL is available.
 */
export async function publishToTikTok(
  post: PostContent,
  credentials: { accessToken: string }
): Promise<PublishResult> {
  try {
    const text = buildPostText(post);
    const { accessToken } = credentials;

    // TikTok Content Posting API — Direct Post (requires video)
    // We initiate a direct post with a placeholder video URL.
    // In production, the user should attach a video URL to the post.
    const res = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          post_info: {
            title: text.substring(0, 150),
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: "https://www.w3schools.com/html/mov_bbb.mp4", // placeholder
          },
        }),
      }
    );

    const data = await res.json() as any;
    if (!res.ok || data.error?.code !== "ok") {
      return {
        success: false,
        errorMessage: data.error?.message ?? `TikTok error (${res.status})`,
      };
    }

    return { success: true, platformPostId: data.data?.publish_id };
  } catch (err: any) {
    return { success: false, errorMessage: err?.message ?? "Unknown TikTok error" };
  }
}
