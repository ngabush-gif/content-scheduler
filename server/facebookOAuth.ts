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
 * Exchange authorization code for short-lived user access token
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

  const response = await fetch(url.toString(), { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("Facebook token exchange error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to exchange code for token: ${data.error?.message || "Unknown error"}`,
    });
  }

  return data as FacebookTokenResponse;
}

/**
 * Exchange short-lived token for long-lived token
 * Long-lived tokens last ~60 days and can be refreshed
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

  const response = await fetch(url.toString(), { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("Facebook long-lived token exchange error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to exchange for long-lived token: ${data.error?.message || "Unknown error"}`,
    });
  }

  return data as FacebookTokenResponse;
}

/**
 * Fetch user's Facebook pages using long-lived token
 */
export async function getUserPages(
  accessToken: string
): Promise<FacebookPage[]> {
  const url = new URL(`${FACEBOOK_GRAPH_URL}/me/accounts`);
  url.searchParams.append("access_token", accessToken);
  url.searchParams.append("limit", "100");

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("Facebook pages fetch error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to fetch pages: ${data.error?.message || "Unknown error"}`,
    });
  }

  const pagesData = data as FacebookPagesResponse;
  return pagesData.data || [];
}

/**
 * Get page access token (for publishing)
 * Page access tokens are long-lived and don't expire
 */
export async function getPageAccessToken(
  pageId: string,
  userAccessToken: string
): Promise<string> {
  const url = new URL(`${FACEBOOK_GRAPH_URL}/${pageId}`);
  url.searchParams.append("fields", "access_token");
  url.searchParams.append("access_token", userAccessToken);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("Facebook page token fetch error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get page token: ${data.error?.message || "Unknown error"}`,
    });
  }

  return data.access_token;
}

/**
 * Verify token is still valid
 * Returns true if token is valid and not expired
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
    console.error("Token verification error:", error);
    return false;
  }
}

/**
 * Calculate token expiry date from expires_in seconds
 */
export function calculateTokenExpiry(expiresInSeconds?: number): string | null {
  if (!expiresInSeconds) {
    return null; // No expiry (page access tokens)
  }

  const expiryDate = new Date(Date.now() + expiresInSeconds * 1000);
  return expiryDate.toISOString();
}
