import { TRPCError } from "@trpc/server";

const FACEBOOK_API_VERSION = "v18.0";
const FACEBOOK_GRAPH_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookPagesResponse {
  data: FacebookPage[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

/**
 * Generate Facebook OAuth authorization URL
 */
export function getFacebookAuthUrl(state: string): string {
  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  if (!appId || !redirectUri) {
    throw new Error("Facebook credentials not configured");
  }

  const scopes = [
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_show_list",
  ];

  const url = new URL("https://www.facebook.com/v18.0/dialog/oauth");
  url.searchParams.append("client_id", appId);
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("scope", scopes.join(","));
  url.searchParams.append("response_type", "code");
  url.searchParams.append("state", state);

  return url.toString();
}

/**
 * Exchange authorization code for user access token
 */
export async function exchangeCodeForToken(
  code: string
): Promise<FacebookTokenResponse> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Facebook credentials not configured");
  }

  const url = new URL(`${FACEBOOK_GRAPH_URL}/oauth/access_token`);
  url.searchParams.append("client_id", appId);
  url.searchParams.append("client_secret", appSecret);
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("code", code);

  console.log("[Facebook] Exchanging authorization code for access token...");
  const response = await fetch(url.toString(), { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("[Facebook] Token exchange error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to exchange code for token: ${data.error?.message || "Unknown error"}`,
    });
  }

  console.log("[Facebook] Successfully exchanged code for access token");
  return data as FacebookTokenResponse;
}

/**
 * Exchange short-lived token for long-lived token
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<FacebookTokenResponse> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Facebook credentials not configured");
  }

  const url = new URL(`${FACEBOOK_GRAPH_URL}/oauth/access_token`);
  url.searchParams.append("grant_type", "fb_exchange_token");
  url.searchParams.append("client_id", appId);
  url.searchParams.append("client_secret", appSecret);
  url.searchParams.append("fb_exchange_token", shortLivedToken);

  console.log("[Facebook] Exchanging short-lived token for long-lived token...");
  const response = await fetch(url.toString(), { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("[Facebook] Long-lived token exchange error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to exchange for long-lived token: ${data.error?.message || "Unknown error"}`,
    });
  }

  console.log("[Facebook] Successfully exchanged for long-lived token");
  return data as FacebookTokenResponse;
}

/**
 * Calculate token expiry date
 */
export function calculateTokenExpiry(expiresIn?: number): string | null {
  if (!expiresIn) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

/**
 * Fetch user's Facebook pages
 */
export async function getUserPages(
  accessToken: string
): Promise<FacebookPage[]> {
  const url = new URL(`${FACEBOOK_GRAPH_URL}/me/accounts`);
  url.searchParams.append("access_token", accessToken);
  url.searchParams.append("limit", "100");
  url.searchParams.append("fields", "id,name,access_token");

  console.log("[Facebook] Fetching /me/accounts...");
  const response = await fetch(url.toString());
  const data = await response.json();

  console.log("[Facebook] /me/accounts response:", JSON.stringify(data, null, 2));

  if (!response.ok || data.error) {
    console.error("[Facebook] Pages fetch error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to fetch pages: ${data.error?.message || "Unknown error"}`,
    });
  }

  const pagesData = data as FacebookPagesResponse;
  const pages = pagesData.data || [];
  console.log(`[Facebook] Found ${pages.length} pages:`, pages.map(p => ({ id: p.id, name: p.name })));
  return pages;
}

/**
 * Fetch a specific page's access token directly
 * Used when /me/accounts doesn't return the page but user has admin access
 */
export async function getPageAccessToken(
  pageId: string,
  userAccessToken: string
): Promise<FacebookPage | null> {
  const url = new URL(`${FACEBOOK_GRAPH_URL}/${pageId}`);
  url.searchParams.append("fields", "id,name,access_token");
  url.searchParams.append("access_token", userAccessToken);

  console.log(`[Facebook] Fetching page token directly for page ${pageId}...`);
  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error(`[Facebook] Failed to fetch page token for ${pageId}:`, data.error);
    return null;
  }

  const page = data as FacebookPage;
  if (!page.access_token) {
    console.warn(`[Facebook] Page ${pageId} has no access_token in response`);
    return null;
  }

  console.log(`[Facebook] Successfully fetched page token for ${pageId}: ${page.name}`);
  return page;
}

/**
 * Find a specific page by ID from pages list
 */
export function findPageById(
  pages: FacebookPage[],
  pageId: string
): FacebookPage | null {
  const page = pages.find((p) => p.id === pageId);
  if (!page) {
    console.warn(`[Facebook] Page ${pageId} not found in pages list`);
    return null;
  }
  console.log(`[Facebook] Found page ${pageId}: ${page.name}`);
  return page;
}

/**
 * Extract page access token from page object
 */
export function extractPageAccessToken(page: FacebookPage): string {
  if (!page.access_token) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Page access token not available",
    });
  }
  console.log(`[Facebook] Extracted page token for page ${page.id}`);
  return page.access_token;
}

/**
 * Verify token is still valid
 */
export async function verifyToken(accessToken: string): Promise<boolean> {
  const url = new URL(`${FACEBOOK_GRAPH_URL}/debug_token`);
  url.searchParams.append("input_token", accessToken);
  url.searchParams.append("access_token", accessToken);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
      return false;
    }

    // Check if token is valid and not expired
    const tokenData = data.data;
    return tokenData.is_valid === true && (!tokenData.expires_at || tokenData.expires_at > Math.floor(Date.now() / 1000));
  } catch (error) {
    console.error("[Facebook] Token verification error:", error);
    return false;
  }
}

/**
 * Refresh Facebook token by re-fetching pages
 * This gets a fresh page access token from Facebook
 */
export async function refreshPageToken(
  userAccessToken: string,
  pageId: string
): Promise<string | null> {
  try {
    console.log(`[Facebook] Attempting to refresh token for page ${pageId}...`);
    
    // Try to get fresh page token
    const page = await getPageAccessToken(pageId, userAccessToken);
    if (page && page.access_token) {
      console.log(`[Facebook] Successfully refreshed token for page ${pageId}`);
      return page.access_token;
    }
    
    console.warn(`[Facebook] Could not refresh token for page ${pageId}`);
    return null;
  } catch (error) {
    console.error(`[Facebook] Error refreshing token for page ${pageId}:`, error);
    return null;
  }
}

/**
 * Get detailed token info for debugging (scopes, type, page, expiry)
 */
export async function getTokenInfo(accessToken: string): Promise<any> {
  const url = new URL(`${FACEBOOK_GRAPH_URL}/debug_token`);
  url.searchParams.append("input_token", accessToken);
  url.searchParams.append("access_token", accessToken);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error(`[Facebook] Token info error:`, data.error);
      return null;
    }

    const tokenData = data.data;
    return {
      type: tokenData.type,  // 'PAGE' or 'USER'
      appId: tokenData.app_id,
      userId: tokenData.user_id,
      isValid: tokenData.is_valid,
      expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null,
      scopes: tokenData.scopes || [],
      error: tokenData.error,
    };
  } catch (error) {
    console.error("[Facebook] Error getting token info:", error);
    return null;
  }
}
