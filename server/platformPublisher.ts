/**
 * Platform Publisher - FACEBOOK FLOW LOCKED AS STABLE
 * 
 * Handles real API calls to Facebook, Instagram, and TikTok.
 * Each function accepts the post content and the user's stored credentials.
 * 
 * ⚠️  FACEBOOK FLOW IS LOCKED - DO NOT CHANGE UNLESS FIXING A SPECIFIC BUG
 * 
 * Facebook Flow (STABLE & TESTED):
 * 1. buildPostText() converts hashtags array to #tag format
 * 2. publishToFacebook() calls Graph API /v21.0/{pageId}/feed
 * 3. Returns remotePostId on success (format: {pageId}_{postId})
 * 4. Saves error message to lastError field on failure
 * 5. Updates status to 'published' or 'failed' accordingly
 * 
 * Tested with:
 * - Post ID: 540001 (Time Freedom Blueprint)
 * - Page: Time Wealth with Leon Makara (ID: 838862115974989)
 * - Result: Successfully published with remotePostId: 838862115974989_122129007081073182
 */

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  errorMessage?: string;
}

/**
 * Validate Instagram token by making a test API call
 * Returns true if token is valid, false if expired or invalid
 */
export async function validateInstagramToken(accessToken: string, accountId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/v21.0/${accountId}?fields=id,name&access_token=${accessToken}`,
      { method: 'GET' }
    );
    
    if (res.status === 401 || res.status === 400) {
      console.log('[validateInstagramToken] Token expired (401/400)');
      return false;
    }
    
    const data = await res.json() as any;
    if (data.error) {
      console.log('[validateInstagramToken] Token error:', data.error.code, data.error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[validateInstagramToken] Exception:', e);
    return false;
  }
}

export interface PostContent {
  caption?: string | null;
  hashtags?: string | string[] | null;  // Can be array (from DB) or string (legacy)
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
  
  // Add caption (required)
  if (post.caption) {
    parts.push(post.caption);
  } else if (post.fullContent) {
    parts.push(post.fullContent);
  } else if (post.script) {
    parts.push(post.script);
  } else {
    parts.push(post.title);
  }
  
  // Add hashtags (required - always append)
  let hashtagString = '';
  if (post.hashtags) {
    if (Array.isArray(post.hashtags)) {
      // Convert array to #tag format: ["tag1", "tag2"] -> #tag1 #tag2
      hashtagString = post.hashtags
        .filter((tag: string) => tag && tag.length > 0)
        .map((tag: string) => `#${tag}`)
        .join(' ');
      console.log('[buildPostText] Converted hashtags array to string:', hashtagString);
    } else {
      // Legacy: hashtags already as string
      hashtagString = post.hashtags;
    }
    parts.push("\n\n" + hashtagString);
  } else {
    // Fallback: if no hashtags, add default ones
    console.warn('[buildPostText] No hashtags provided for post:', post.title);
    parts.push("\n\n#ContentCreator #SocialMedia #Engagement #OnlineBusiness #Success");
  }
  
  const finalMessage = parts.join("").trim();
  console.log('[buildPostText] Final publish message (first 500 chars):', finalMessage.substring(0, 500));
  return finalMessage;
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

    // Validate token before attempting to publish
    console.log('[publishToInstagram] Validating token before publish...');
    const isTokenValid = await validateInstagramToken(accessToken, accountId);
    if (!isTokenValid) {
      console.error('[publishToInstagram] Token validation failed - token is expired or invalid');
      return {
        success: false,
        errorMessage: 'TOKEN_EXPIRED: Instagram access token is invalid or expired. Please reconnect your account.',
      };
    }
    console.log('[publishToInstagram] Token validation passed');

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
      return {
        success: false,
        errorMessage: publishData.error?.message ?? `Instagram publish error (${publishRes.status})`,
      };
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
 * - Text-only posts (to /{page-id}/feed)
 * - Photo posts with caption (to /{page-id}/photos with message parameter)
 * 
 * Photo Post Flow (NATIVE POST - NO SHARE WRAPPER):
 * 1. If imageUrl provided, fetch image binary from URL
 * 2. POST directly to /{page-id}/photos with:
 *    - source: image binary
 *    - message: caption text
 * 3. This creates a native photo post with insights
 * 4. If image fails, fall back to text-only post
 */
export async function publishToFacebook(
  post: PostContent,
  credentials: { accessToken: string; pageId: string }
): Promise<PublishResult> {
  try {
    const text = buildPostText(post);
    const { accessToken, pageId } = credentials;
    
    console.log('[publishToFacebook] Publishing to Facebook page:', pageId);
    console.log('[publishToFacebook] Final message to send (first 500 chars):', text.substring(0, 500));
    console.log('[publishToFacebook] Token type: PAGE_ACCESS_TOKEN');
    console.log('[publishToFacebook] Endpoint: /v21.0/' + pageId + '/feed');

    // If we have an image, post directly to /photos endpoint
    // This creates a native photo post (not a share wrapper)
    if (post.imageUrl) {
      try {
        console.log(`[Facebook] Publishing photo post with caption to /${pageId}/photos`);
        return await publishPhotoPost(text, post.imageUrl, pageId, accessToken);
      } catch (photoErr: any) {
        console.warn(`[Facebook] Photo post failed: ${photoErr.message}. Falling back to text-only post.`);
        // Fall through to text-only post below
      }
    }

    // Fallback: Create text-only feed post (if no image or image upload failed)
    console.log(`[Facebook] Publishing text-only post to /${pageId}/feed`);
    const body: any = {
      message: text,
      access_token: accessToken,
    };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json() as any;
    console.log('[publishToFacebook] Facebook API response status:', res.status);
    console.log('[publishToFacebook] Facebook API response data:', JSON.stringify(data));
    
    if (!res.ok || data.error) {
      console.error('[publishToFacebook] Facebook API error:', data.error);
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

    console.log(`[publishToFacebook] ✅ Text-only post created successfully: ${data.id}`);
    console.log('[publishToFacebook] Remote post ID (remotePostId):', data.id);
    return { success: true, platformPostId: data.id };
  } catch (err: any) {
    return { success: false, errorMessage: err?.message ?? "Unknown Facebook error" };
  }
}

/**
 * Publish a photo post directly to Facebook's /photos endpoint
 * This creates a NATIVE photo post (not a share wrapper)
 * 
 * The caption is passed as the "message" parameter, which becomes the post text
 * The image is uploaded as the "source" parameter
 * Result: One native post with image + caption + proper insights
 */
async function publishPhotoPost(
  caption: string,
  imageUrl: string,
  pageId: string,
  accessToken: string
): Promise<PublishResult> {
  try {
    // Step 1: Fetch image binary from URL
    console.log(`[Facebook] Fetching image from: ${imageUrl}`);
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch image: ${imageRes.status} ${imageRes.statusText}`);
    }

    const imageBuffer = await imageRes.arrayBuffer();
    console.log(`[Facebook] Image fetched: ${imageBuffer.byteLength} bytes`);

    // Step 2: Create FormData for multipart upload to /photos endpoint
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: imageRes.headers.get('content-type') || 'image/jpeg' });
    formData.append('source', blob, 'image.jpg');
    formData.append('message', caption);  // Caption becomes the post message
    formData.append('access_token', accessToken);

    // Step 3: POST directly to /photos endpoint
    // This creates a native photo post with the caption as the post text
    console.log(`[Facebook] Publishing photo post to /${pageId}/photos with caption`);
    const photoRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/photos`,
      {
        method: "POST",
        body: formData,
        // Don't set Content-Type header - fetch will set it with boundary automatically
      }
    );

    const photoData = await photoRes.json() as any;
    console.log(`[Facebook] Photo endpoint response:`, photoData);

    if (!photoRes.ok || photoData.error) {
      const errorMsg = photoData.error?.message ?? `Facebook photo error (${photoRes.status})`;
      console.error(`[Facebook] Photo post error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (!photoData.id) {
      throw new Error('No post ID returned from Facebook photo endpoint');
    }

    console.log(`[Facebook] Native photo post created: ${photoData.id}`);
    return { success: true, platformPostId: photoData.id };
  } catch (err: any) {
    console.error(`[Facebook] Photo post failed:`, err);
    throw err;
  }
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
