import { TRPCError } from "@trpc/server";

const INSTAGRAM_API_VERSION = "v18.0";
const INSTAGRAM_GRAPH_URL = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;

interface InstagramAccount {
  id: string;
  username: string;
}

interface InstagramTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface InstagramUserResponse {
  id: string;
  username: string;
}

/**
 * Generate Instagram OAuth authorization URL
 * Uses Facebook Login since Instagram is part of Meta
 */
export function getInstagramAuthUrl(state: string): string {
  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || process.env.FACEBOOK_REDIRECT_URI;

  if (!appId || !redirectUri) {
    throw new Error("Instagram credentials not configured");
  }

  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
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
): Promise<InstagramTokenResponse> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || process.env.FACEBOOK_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Instagram credentials not configured");
  }

  const url = new URL(`${INSTAGRAM_GRAPH_URL}/oauth/access_token`);
  url.searchParams.append("client_id", appId);
  url.searchParams.append("client_secret", appSecret);
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("code", code);

  console.log("[Instagram] Exchanging authorization code for access token...");
  const response = await fetch(url.toString(), { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("[Instagram] Token exchange error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to exchange code for token: ${data.error?.message || "Unknown error"}`,
    });
  }

  console.log("[Instagram] Successfully exchanged code for access token");
  return data as InstagramTokenResponse;
}

/**
 * Exchange short-lived token for long-lived token
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<InstagramTokenResponse> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Instagram credentials not configured");
  }

  const url = new URL(`${INSTAGRAM_GRAPH_URL}/oauth/access_token`);
  url.searchParams.append("grant_type", "ig_refresh_token");
  url.searchParams.append("access_token", shortLivedToken);

  console.log("[Instagram] Exchanging short-lived token for long-lived token...");
  const response = await fetch(url.toString(), { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("[Instagram] Long-lived token exchange error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to exchange for long-lived token: ${data.error?.message || "Unknown error"}`,
    });
  }

  console.log("[Instagram] Successfully exchanged for long-lived token");
  return data as InstagramTokenResponse;
}

/**
 * Calculate token expiry date
 */
export function calculateTokenExpiry(expiresIn?: number): string | null {
  if (!expiresIn) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

/**
 * Get Instagram business account info
 */
export async function getInstagramAccount(
  accessToken: string
): Promise<InstagramAccount> {
  const url = new URL(`${INSTAGRAM_GRAPH_URL}/me`);
  url.searchParams.append("fields", "id,username");
  url.searchParams.append("access_token", accessToken);

  console.log("[Instagram] Fetching /me...");
  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("[Instagram] Account fetch error:", data.error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to fetch account: ${data.error?.message || "Unknown error"}`,
    });
  }

  const account = data as InstagramUserResponse;
  console.log(`[Instagram] Successfully fetched account: ${account.username} (${account.id})`);
  return {
    id: account.id,
    username: account.username,
  };
}

/**
 * Verify token is still valid
 */
export async function verifyToken(accessToken: string): Promise<boolean> {
  const url = new URL(`${INSTAGRAM_GRAPH_URL}/me`);
  url.searchParams.append("fields", "id");
  url.searchParams.append("access_token", accessToken);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
      console.warn("[Instagram] Token verification failed:", data.error?.message);
      return false;
    }

    console.log("[Instagram] Token is valid");
    return true;
  } catch (error) {
    console.error("[Instagram] Token verification error:", error);
    return false;
  }
}

/**
 * Refresh Instagram token
 * Instagram long-lived tokens can be refreshed by calling the refresh endpoint
 */
export async function refreshToken(
  accessToken: string
): Promise<string | null> {
  try {
    console.log("[Instagram] Attempting to refresh token...");
    
    const url = new URL(`${INSTAGRAM_GRAPH_URL}/refresh_access_token`);
    url.searchParams.append("grant_type", "ig_refresh_token");
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
      console.warn("[Instagram] Token refresh failed:", data.error?.message);
      return null;
    }

    console.log("[Instagram] Successfully refreshed token");
    return data.access_token;
  } catch (error) {
    console.error("[Instagram] Error refreshing token:", error);
    return null;
  }
}

/**
 * Get detailed token info for debugging
 */
export async function getTokenInfo(accessToken: string): Promise<any> {
  const url = new URL(`${INSTAGRAM_GRAPH_URL}/debug_token`);
  url.searchParams.append("input_token", accessToken);
  url.searchParams.append("access_token", accessToken);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("[Instagram] Token info error:", data.error);
      return null;
    }

    const tokenData = data.data;
    return {
      type: tokenData.type,
      appId: tokenData.app_id,
      userId: tokenData.user_id,
      isValid: tokenData.is_valid,
      expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null,
      scopes: tokenData.scopes || [],
      error: tokenData.error,
    };
  } catch (error) {
    console.error("[Instagram] Error getting token info:", error);
    return null;
  }
}
