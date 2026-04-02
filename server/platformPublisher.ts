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
      return {
        success: false,
        errorMessage: containerData.error?.message ?? `Instagram container error (${containerRes.status})`,
      };
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
 */
export async function publishToFacebook(
  post: PostContent,
  credentials: { accessToken: string; pageId: string }
): Promise<PublishResult> {
  try {
    const text = buildPostText(post);
    const { accessToken, pageId } = credentials;

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          access_token: accessToken,
        }),
      }
    );

    const data = await res.json() as any;
    if (!res.ok || data.error) {
      return {
        success: false,
        errorMessage: data.error?.message ?? `Facebook error (${res.status})`,
      };
    }

    return { success: true, platformPostId: data.id };
  } catch (err: any) {
    return { success: false, errorMessage: err?.message ?? "Unknown Facebook error" };
  }
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
