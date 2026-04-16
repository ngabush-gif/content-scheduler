import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getFacebookAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getUserPages,
  findPageById,
  extractPageAccessToken,
  verifyToken,
  calculateTokenExpiry,
  getPageAccessToken,
} from "./facebookOAuth";
import { getDb } from "./db";
import { platformConnections } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const TARGET_PAGE_ID = "838862115974989"; // Time Wealth with Leon Makara

export const connectionsRouter = router({
  /**
   * Get Facebook OAuth authorization URL
   */
  getFacebookAuthUrl: publicProcedure
    .input(z.object({ state: z.string() }))
    .query(({ input }: any) => {
      const url = getFacebookAuthUrl(input.state);
      return { url };
    }),

  /**
   * Handle Facebook OAuth callback
   * Exchange code for long-lived token, fetch pages, extract page token
   */
  handleFacebookCallback: publicProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string(),
        userId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log(`[OAuth] Starting callback for user ${input.userId}`);

        // Step 1: Exchange code for short-lived user access token
        const shortLivedTokenResponse = await exchangeCodeForToken(input.code);
        const shortLivedToken = shortLivedTokenResponse.access_token;
        console.log("[OAuth] Received short-lived token");

        // Step 2: Exchange short-lived token for long-lived token (60 days)
        const longLivedTokenResponse = await exchangeForLongLivedToken(shortLivedToken);
        const userAccessToken = longLivedTokenResponse.access_token;
        const userTokenExpiry = calculateTokenExpiry(longLivedTokenResponse.expires_in);
        console.log("[OAuth] Exchanged for long-lived user token, expires at:", userTokenExpiry);

        // Step 3: Fetch user's pages using long-lived token
        const pages = await getUserPages(userAccessToken);

        // Step 4: Find the target page (Time Wealth with Leon Makara)
        let targetPage = findPageById(pages, TARGET_PAGE_ID);

        // Step 4b: If not found in /me/accounts, try fetching directly
        // (some page configurations don't return in /me/accounts but are still accessible)
        if (!targetPage) {
          console.log(`[OAuth] Page ${TARGET_PAGE_ID} not in /me/accounts, trying direct fetch...`);
          targetPage = await getPageAccessToken(TARGET_PAGE_ID, userAccessToken);
        }

        if (!targetPage) {
          console.error(`[OAuth] Target page ${TARGET_PAGE_ID} not found`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Page ${TARGET_PAGE_ID} not found. You must have admin access to "Time Wealth with Leon Makara" page.`,
          });
        }

        // Step 5: Extract page access token (already included in /me/accounts response)
        const pageAccessToken = extractPageAccessToken(targetPage);
        console.log(`[OAuth] Extracted page token for page ${TARGET_PAGE_ID}`);

        // Step 6: Save connection to database
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        console.log(`[OAuth] Checking for existing connection for user ${input.userId}`);

        // Check if connection already exists
        const existingConnection = await db
          .select()
          .from(platformConnections)
          .where(
            and(
              eq(platformConnections.userId, input.userId),
              eq(platformConnections.platform, "facebook"),
              eq(platformConnections.accountId, TARGET_PAGE_ID)
            )
          )
          .limit(1);

        let connectionId: number;

        if (existingConnection.length > 0) {
          console.log(`[OAuth] Updating existing connection ${existingConnection[0].id}`);
          // Update existing connection with new tokens
          await db
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
          console.log(`[OAuth] Creating new connection for user ${input.userId}`);
          // Create new connection with page token
          const result = await db.insert(platformConnections).values({
            userId: input.userId,
            platform: "facebook",
            accountName: targetPage.name,
            accountId: TARGET_PAGE_ID,
            accessToken: pageAccessToken,
            isActive: 1,
            connectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: userTokenExpiry,
          });

          connectionId = result[0].insertId;
          console.log(`[OAuth] Created new connection ${connectionId}`);
        }

        console.log(`[OAuth] Successfully saved connection ${connectionId} with page token`);

        return {
          success: true,
          connectionId,
          pageName: targetPage.name,
          pageId: TARGET_PAGE_ID,
          message: `Successfully connected to Facebook page: ${targetPage.name}`,
        };
      } catch (error) {
        console.error("[OAuth] Facebook callback error:", error);
        throw error;
      }
    }),

  /**
   * Get all Facebook connections for user
   */
  getFacebookConnections: protectedProcedure.query(async ({ ctx }: { ctx: any }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const connections = await db
      .select()
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.userId, ctx.user.id),
          eq(platformConnections.platform, "facebook")
        )
      );

    // Verify tokens and mark as inactive if expired
    const verificationsPromises = connections.map(async (conn: any) => {
      const isValid = await verifyToken(conn.accessToken);
      if (!isValid && conn.isActive && db) {
        console.log(`[Connections] Marking connection ${conn.id} as inactive (token invalid)`);
        await db
          .update(platformConnections)
          .set({ isActive: 0 })
          .where(eq(platformConnections.id, conn.id));
      }
      return { ...conn, isValid };
    });

    const verificationsResults = await Promise.all(verificationsPromises);

    return verificationsResults.map((conn: any) => ({
      id: conn.id,
      pageId: conn.accountId,
      pageName: conn.accountName,
      isActive: conn.isActive === 1,
      isValid: conn.isValid,
      connectedAt: conn.connectedAt,
    }));
  }),

  /**
   * Disconnect a Facebook page
   */
  disconnectFacebook: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input, ctx }: { input: { connectionId: number }; ctx: any }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify connection belongs to user
      const connection = await db
        .select()
        .from(platformConnections)
        .where(eq(platformConnections.id, input.connectionId))
        .limit(1);

      if (!connection.length || connection[0].userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Connection not found or does not belong to you",
        });
      }

      // Delete connection
      if (db) {
        await db
          .delete(platformConnections)
          .where(eq(platformConnections.id, input.connectionId));
      }

      return { success: true, message: "Facebook connection removed" };
    }),

  /**
   * Reconnect a Facebook page (re-authenticate)
   */
  reconnectFacebook: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input, ctx }: { input: { connectionId: number }; ctx: any }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify connection belongs to user
      const connection = await db
        .select()
        .from(platformConnections)
        .where(eq(platformConnections.id, input.connectionId))
        .limit(1);

      if (!connection.length || connection[0].userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Connection not found or does not belong to you",
        });
      }

      // Mark as inactive until re-authenticated
      if (db) {
        await db
          .update(platformConnections)
          .set({ isActive: 0 })
          .where(eq(platformConnections.id, input.connectionId));
      }

      // Return auth URL for user to reconnect
      const state = JSON.stringify({
        userId: ctx.user.id,
        connectionId: input.connectionId,
        action: "reconnect",
      });

      const authUrl = getFacebookAuthUrl(state);

      return {
        authUrl,
        message: "Please click the link to reconnect your Facebook page",
      };
    }),
});
