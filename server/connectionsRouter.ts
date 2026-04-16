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
import {
  getInstagramAuthUrl,
  exchangeCodeForToken as instagramExchangeCodeForToken,
  exchangeForLongLivedToken as instagramExchangeForLongLivedToken,
  getInstagramAccount,
  verifyToken as instagramVerifyToken,
  calculateTokenExpiry as instagramCalculateTokenExpiry,
} from "./instagramOAuth";
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
      // Encode state as JSON so callback can parse it
      const stateObj = JSON.stringify({ userId: parseInt(input.state, 10) });
      const url = getFacebookAuthUrl(stateObj);
      return { url };
    }),

  // NOTE: Facebook OAuth callback is now handled by Express route at /api/oauth/facebook/callback
  // This tRPC procedure has been removed to avoid confusion and ensure consistent OAuth flow

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

  /**
   * Get Instagram OAuth authorization URL
   */
  getInstagramAuthUrl: publicProcedure
    .input(z.object({ state: z.string() }))
    .query(({ input }: any) => {
      // Encode state as JSON so callback can parse it
      const stateObj = JSON.stringify({ userId: parseInt(input.state, 10) });
      const url = getInstagramAuthUrl(stateObj);
      return { url };
    }),

  /**
   * Get all Instagram connections for user
   */
  getInstagramConnections: protectedProcedure.query(async ({ ctx }: { ctx: any }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const connections = await db
      .select()
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.userId, ctx.user.id),
          eq(platformConnections.platform, "instagram")
        )
      );

    // Verify tokens and mark as inactive if expired
    const verificationsPromises = connections.map(async (conn: any) => {
      const isValid = await instagramVerifyToken(conn.accessToken);
      if (!isValid && conn.isActive && db) {
        console.log(`[Connections] Marking Instagram connection ${conn.id} as inactive (token invalid)`);
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
      accountId: conn.accountId,
      accountName: conn.accountName,
      isActive: conn.isActive === 1,
      isValid: conn.isValid,
      connectedAt: conn.connectedAt,
    }));
  }),

  /**
   * Disconnect an Instagram account
   */
  disconnectInstagram: protectedProcedure
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

      return { success: true, message: "Instagram connection removed" };
    }),

  /**
   * Reconnect an Instagram account (re-authenticate)
   */
  reconnectInstagram: protectedProcedure
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

      const authUrl = getInstagramAuthUrl(state);

      return {
        authUrl,
        message: "Please click the link to reconnect your Instagram account",
      };
    }),
});
