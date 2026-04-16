import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { exchangeCodeForToken, exchangeForLongLivedToken, getUserPages, findPageById, getPageAccessToken, extractPageAccessToken, calculateTokenExpiry } from "../facebookOAuth";
import { exchangeCodeForToken as instagramExchangeCodeForToken, exchangeForLongLivedToken as instagramExchangeForLongLivedToken, getInstagramAccount, calculateTokenExpiry as instagramCalculateTokenExpiry } from "../instagramOAuth";
import { getDb } from "../db";
import { platformConnections } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Manus OAuth callback (user login)
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date().toISOString(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[OAuth] Callback failed:", errorMsg);
      console.error("[OAuth] Full error:", error);
      res.status(500).json({ error: `OAuth callback failed: ${errorMsg}` });
    }
  });

  // Facebook OAuth callback (platform connection)
  app.get("/api/oauth/facebook/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const error = getQueryParam(req, "error");
    const errorDescription = getQueryParam(req, "error_description");

    console.log("[Facebook OAuth Callback] Received request");
    console.log("[Facebook OAuth Callback] Raw state:", state);
    console.log("[Facebook OAuth Callback] Session cookie:", req.headers.cookie ? "present" : "missing");
    console.log("[Facebook OAuth Callback] Code:", code ? "present" : "missing");
    console.log("[Facebook OAuth Callback] State:", state ? "present" : "missing");
    console.log("[Facebook OAuth Callback] Error:", error || "none");

    // Handle Facebook OAuth errors
    if (error) {
      console.error("[Facebook OAuth Callback] Facebook error:", error, errorDescription);
      const errorMsg = encodeURIComponent(`Facebook error: ${error} - ${errorDescription || "Unknown error"}`);
      return res.redirect(302, `/connections?error=${errorMsg}`);
    }

    if (!code || !state) {
      console.error("[Facebook OAuth Callback] Missing code or state");
      const errorMsg = encodeURIComponent("Missing authorization code or state");
      return res.redirect(302, `/connections?error=${errorMsg}`);
    }

    try {
      // Step 0: Verify authenticated session
      let authenticatedUser: any;
      try {
        authenticatedUser = await sdk.authenticateRequest(req);
        console.log("[Facebook OAuth Callback] Authenticated user:", authenticatedUser?.id);
      } catch (e) {
        console.error("[Facebook OAuth Callback] No authenticated session");
        const errorMsg = encodeURIComponent("You must be logged in to connect a platform account");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      if (!authenticatedUser || !authenticatedUser.id) {
        console.error("[Facebook OAuth Callback] Authenticated user has no ID");
        const errorMsg = encodeURIComponent("Authentication failed: user ID missing");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      // Step 1: Parse state and verify it matches authenticated user
      let userId: number;
      try {
        const stateObj = JSON.parse(state);
        userId = stateObj.userId;
        console.log("[Facebook OAuth Callback] Parsed state, userId:", userId);
      } catch (e) {
        console.error("[Facebook OAuth Callback] Failed to parse state:", e);
        const errorMsg = encodeURIComponent("Invalid state parameter");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      if (!userId) {
        console.error("[Facebook OAuth Callback] userId not found in state");
        const errorMsg = encodeURIComponent("User ID not found in state");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      // Verify state userId matches authenticated user
      if (userId !== authenticatedUser.id) {
        console.error("[Facebook OAuth Callback] State userId mismatch. State:", userId, "Authenticated:", authenticatedUser.id);
        const errorMsg = encodeURIComponent("User ID mismatch: state does not match authenticated user");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      console.log("[Facebook OAuth Callback] User verified. Starting token exchange for user", userId);

      // Step 1: Exchange code for short-lived token
      const shortLivedTokenResponse = await exchangeCodeForToken(code);
      const shortLivedToken = shortLivedTokenResponse.access_token;
      console.log("[Facebook OAuth Callback] Received short-lived token");

      // Step 2: Exchange for long-lived token
      const longLivedTokenResponse = await exchangeForLongLivedToken(shortLivedToken);
      const userAccessToken = longLivedTokenResponse.access_token;
      const userTokenExpiry = calculateTokenExpiry(longLivedTokenResponse.expires_in);
      console.log("[Facebook OAuth Callback] Exchanged for long-lived token, expires:", userTokenExpiry);

      // Step 3: Fetch user's pages
      const pages = await getUserPages(userAccessToken);
      console.log("[Facebook OAuth Callback] Fetched", pages.length, "pages");

      // Step 4: Find target page
      const TARGET_PAGE_ID = "838862115974989"; // Time Wealth with Leon Makara
      let targetPage = findPageById(pages, TARGET_PAGE_ID);

      if (!targetPage) {
        console.log("[Facebook OAuth Callback] Page not in /me/accounts, trying direct fetch...");
        targetPage = await getPageAccessToken(TARGET_PAGE_ID, userAccessToken);
      }

      if (!targetPage) {
        console.error("[Facebook OAuth Callback] Target page not found");
        const errorMsg = encodeURIComponent(`Page ${TARGET_PAGE_ID} not found. You must have admin access to the page.`);
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      // Step 5: Extract page token
      const pageAccessToken = extractPageAccessToken(targetPage);
      console.log("[Facebook OAuth Callback] Extracted page token for", targetPage.name);

      // Step 6: Save to database
      const database = await getDb();
      if (!database) {
        console.error("[Facebook OAuth Callback] Database unavailable");
        const errorMsg = encodeURIComponent("Database connection failed");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      // Check for existing connection
      const existingConnection = await database
        .select()
        .from(platformConnections)
        .where(
          and(
            eq(platformConnections.userId, userId),
            eq(platformConnections.platform, "facebook"),
            eq(platformConnections.accountId, TARGET_PAGE_ID)
          )
        )
        .limit(1);

      let connectionId: number;

      if (existingConnection.length > 0) {
        console.log("[Facebook OAuth Callback] Updating existing connection", existingConnection[0].id);
        await database
          .update(platformConnections)
          .set({
            accessToken: pageAccessToken,
            expiresAt: userTokenExpiry,
            isActive: 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(platformConnections.id, existingConnection[0].id));
        connectionId = existingConnection[0].id;
      } else {
        console.log("[Facebook OAuth Callback] Creating new connection for user", userId);
        const result = await database.insert(platformConnections).values({
          userId,
          platform: "facebook",
          accountName: targetPage.name,
          accountId: TARGET_PAGE_ID,
          accessToken: pageAccessToken,
          isActive: 1,
          connectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: userTokenExpiry,
        });
        connectionId = (result as any)[0].insertId;
        console.log("[Facebook OAuth Callback] Created new connection", connectionId);
      }

      console.log("[Facebook OAuth Callback] Successfully saved connection", connectionId);
      const successMsg = encodeURIComponent(`Successfully connected to Facebook page: ${targetPage.name}`);
      return res.redirect(302, `/connections?success=${successMsg}`);
    } catch (error) {
      console.error("[Facebook OAuth Callback] Error:", error);
      const errorMsg = encodeURIComponent(`Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      return res.redirect(302, `/connections?error=${errorMsg}`);
    }
  });

  // Instagram OAuth callback (platform connection)
  app.get("/api/oauth/instagram/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const error = getQueryParam(req, "error");
    const errorDescription = getQueryParam(req, "error_description");

    console.log("[Instagram OAuth Callback] Received request");
    console.log("[Instagram OAuth Callback] Raw state:", state);
    console.log("[Instagram OAuth Callback] Session cookie:", req.headers.cookie ? "present" : "missing");
    console.log("[Instagram OAuth Callback] Code:", code ? "present" : "missing");
    console.log("[Instagram OAuth Callback] State:", state ? "present" : "missing");
    console.log("[Instagram OAuth Callback] Error:", error || "none");

    // Handle Instagram OAuth errors
    if (error) {
      console.error("[Instagram OAuth Callback] Instagram error:", error, errorDescription);
      const errorMsg = encodeURIComponent(`Instagram error: ${error} - ${errorDescription || "Unknown error"}`);
      return res.redirect(302, `/connections?error=${errorMsg}`);
    }

    if (!code || !state) {
      console.error("[Instagram OAuth Callback] Missing code or state");
      const errorMsg = encodeURIComponent("Missing authorization code or state");
      return res.redirect(302, `/connections?error=${errorMsg}`);
    }

    try {
      // Step 0: Verify authenticated session
      let authenticatedUser: any;
      try {
        authenticatedUser = await sdk.authenticateRequest(req);
        console.log("[Instagram OAuth Callback] Authenticated user:", authenticatedUser?.id);
      } catch (e) {
        console.error("[Instagram OAuth Callback] No authenticated session");
        const errorMsg = encodeURIComponent("You must be logged in to connect a platform account");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      if (!authenticatedUser || !authenticatedUser.id) {
        console.error("[Instagram OAuth Callback] Authenticated user has no ID");
        const errorMsg = encodeURIComponent("Authentication failed: user ID missing");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      // Step 1: Parse state and verify it matches authenticated user
      let userId: number;
      try {
        const stateObj = JSON.parse(state);
        userId = stateObj.userId;
        console.log("[Instagram OAuth Callback] Parsed state, userId:", userId);
      } catch (e) {
        console.error("[Instagram OAuth Callback] Failed to parse state:", e);
        const errorMsg = encodeURIComponent("Invalid state parameter");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      if (!userId) {
        console.error("[Instagram OAuth Callback] userId not found in state");
        const errorMsg = encodeURIComponent("User ID not found in state");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      // Verify state userId matches authenticated user
      if (userId !== authenticatedUser.id) {
        console.error("[Instagram OAuth Callback] State userId mismatch. State:", userId, "Authenticated:", authenticatedUser.id);
        const errorMsg = encodeURIComponent("User ID mismatch: state does not match authenticated user");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      console.log("[Instagram OAuth Callback] Starting token exchange for user", userId);

      // Step 1: Exchange code for short-lived token
      const shortLivedTokenResponse = await instagramExchangeCodeForToken(code);
      const shortLivedToken = shortLivedTokenResponse.access_token;
      console.log("[Instagram OAuth Callback] Received short-lived token");

      // Step 2: Exchange for long-lived token
      const longLivedTokenResponse = await instagramExchangeForLongLivedToken(shortLivedToken);
      const accessToken = longLivedTokenResponse.access_token;
      const tokenExpiry = instagramCalculateTokenExpiry(longLivedTokenResponse.expires_in);
      console.log("[Instagram OAuth Callback] Exchanged for long-lived token, expires:", tokenExpiry);

      // Step 3: Get Instagram account info
      const account = await getInstagramAccount(accessToken);
      console.log("[Instagram OAuth Callback] Got Instagram account:", account.username);

      // Step 4: Save to database
      const database = await getDb();
      if (!database) {
        console.error("[Instagram OAuth Callback] Database unavailable");
        const errorMsg = encodeURIComponent("Database connection failed");
        return res.redirect(302, `/connections?error=${errorMsg}`);
      }

      // Check for existing connection
      const existingConnection = await database
        .select()
        .from(platformConnections)
        .where(
          and(
            eq(platformConnections.userId, userId),
            eq(platformConnections.platform, "instagram"),
            eq(platformConnections.accountId, account.id)
          )
        )
        .limit(1);

      let connectionId: number;

      if (existingConnection.length > 0) {
        console.log("[Instagram OAuth Callback] Updating existing connection", existingConnection[0].id);
        await database
          .update(platformConnections)
          .set({
            accessToken: accessToken,
            expiresAt: tokenExpiry,
            isActive: 1,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(platformConnections.id, existingConnection[0].id));
        connectionId = existingConnection[0].id;
      } else {
        console.log("[Instagram OAuth Callback] Creating new connection for user", userId);
        const result = await database.insert(platformConnections).values({
          userId,
          platform: "instagram",
          accountName: account.username,
          accountId: account.id,
          accessToken: accessToken,
          isActive: 1,
          connectedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: tokenExpiry,
        });
        connectionId = (result as any)[0].insertId;
        console.log("[Instagram OAuth Callback] Created new connection", connectionId);
      }

      console.log("[Instagram OAuth Callback] Successfully saved connection", connectionId);
      const successMsg = encodeURIComponent(`Successfully connected to Instagram account: ${account.username}`);
      return res.redirect(302, `/connections?success=${successMsg}`);
    } catch (error) {
      console.error("[Instagram OAuth Callback] Error:", error);
      const errorMsg = encodeURIComponent(`Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      return res.redirect(302, `/connections?error=${errorMsg}`);
    }
  });
}
