import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getFacebookAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getUserPages,
  getPageAccessToken,
  verifyToken,
  calculateTokenExpiry,
} from "./facebookOAuth";
import { getDb } from "./db";
import { platformConnections } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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
   * Exchange code for long-lived token and save connection
   */
  handleFacebookCallback: publicProcedure
    .input(
      z.object({
        code: z.string(),
        state: z.string(),
        userId: z.number(),
        selectedPageId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Step 1: Exchange code for short-lived user access token
        const shortLivedTokenResponse = await exchangeCodeForToken(input.code);
        const shortLivedToken = shortLivedTokenResponse.access_token;

        // Step 2: Exchange short-lived token for long-lived token (lasts ~60 days)
        const longLivedTokenResponse = await exchangeForLongLivedToken(shortLivedToken);
        const userAccessToken = longLivedTokenResponse.access_token;
        const userTokenExpiry = calculateTokenExpiry(longLivedTokenResponse.expires_in);

        // Step 3: Fetch user's pages using long-lived token
        const pages = await getUserPages(userAccessToken);

        if (!pages.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No Facebook pages found. Please ensure you have admin access to at least one page.",
          });
        }

        // Step 4: If user selected a specific page, use that; otherwise use first page
        const selectedPage = input.selectedPageId
          ? pages.find((p) => p.id === input.selectedPageId)
          : pages[0];

        if (!selectedPage) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selected page not found",
          });
        }

        // Step 5: Get page access token (page tokens don't expire)
        const pageAccessToken = await getPageAccessToken(
          selectedPage.id,
          userAccessToken
        );

        // Step 6: Save connection to database
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        // Check if connection already exists
        const existingConnection = await db
          .select()
          .from(platformConnections)
          .where(
            and(
              eq(platformConnections.userId, input.userId),
              eq(platformConnections.platform, "facebook"),
              eq(platformConnections.accountId, selectedPage.id)
            )
          )
          .limit(1);

        let connectionId: number;

        if (existingConnection.length > 0) {
          // Update existing connection with new page token
          await db
            .update(platformConnections)
            .set({
              accessToken: pageAccessToken,
              expiresAt: userTokenExpiry,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(platformConnections.id, existingConnection[0].id));

          connectionId = existingConnection[0].id;
        } else {
          // Create new connection with page token
          const result = await db.insert(platformConnections).values({
            userId: input.userId,
            platform: "facebook",
            accountName: selectedPage.name,
            accountId: selectedPage.id,
            accessToken: pageAccessToken,
            isActive: 1,
            connectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: userTokenExpiry,
          });

          connectionId = result[0].insertId;
        }

        return {
          success: true,
          connectionId,
          pageName: selectedPage.name,
          pageId: selectedPage.id,
          message: `Successfully connected to Facebook page: ${selectedPage.name}`,
        };
      } catch (error) {
        console.error("Facebook callback error:", error);
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
