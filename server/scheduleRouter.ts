import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createScheduledPost,
  getContentPostById,
  getPlatformConnectionWithToken,
  getScheduledPosts,
  updateScheduledPost,
} from "./db";

/**
 * Schedule Router: Direct Publishing Endpoints
 * 
 * Handles:
 * - Creating scheduled posts (queued for later publishing)
 * - Listing scheduled posts with status
 * - Retrying failed posts
 * - Cancelling scheduled posts
 */

export const scheduleRouter = router({
  /**
   * Create a scheduled post
   * 
   * Validates:
   * - Post exists and belongs to user
   * - Post is approved
   * - Scheduled time is in the future
   * - Platform connection exists
   * 
   * Returns: scheduledPostId
   */
  create: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        connectionId: z.number(),
        pageId: z.string().optional(),
        platform: z.enum(["facebook", "instagram", "tiktok"]),
        scheduledAt: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Step 1: Verify post exists and belongs to user
      const post = await getContentPostById(input.postId);
      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }
      if (post.authorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Post does not belong to you",
        });
      }

      // Step 2: Verify post is approved
      if (post.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only approved posts can be scheduled",
        });
      }

      // Step 3: Verify scheduled time is in the future
      if (input.scheduledAt <= new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Scheduled time must be in the future",
        });
      }

      // Step 4: Verify connection exists and belongs to user
      const connection = await getPlatformConnectionWithToken(
        ctx.user.id,
        input.platform
      );
      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Platform connection not found",
        });
      }

      // Step 5: Create scheduled post
      const scheduledAtISO = input.scheduledAt instanceof Date ? input.scheduledAt.toISOString() : input.scheduledAt;
      const result = await createScheduledPost({
        postId: input.postId,
        scheduledById: ctx.user.id,
        connectionId: input.connectionId,
        platform: input.platform,
        pageId: input.pageId,
        scheduledAt: scheduledAtISO,
        status: "scheduled",
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // createScheduledPost returns the inserted row with id
      return { success: true, scheduledPostId: result.id || 0 };
    }),

  /**
   * List scheduled posts for the current user
   * 
   * Optionally filter by status
   * 
   * Returns: Array of scheduled posts
   */
  list: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              "scheduled",
              "publishing",
              "published",
              "failed",
              "cancelled",
              "reconnect_required",
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const posts = await getScheduledPosts(ctx.user.id);

      // Filter by status if provided
      if (input?.status) {
        return posts.filter((p) => p.status === input.status);
      }

      return posts;
    }),

  /**
   * Retry a failed scheduled post
   * 
   * Only allows retry on:
   * - failed posts
   * - reconnect_required posts
   * 
   * Resets status to "scheduled" so worker picks it up again
   */
  retry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify scheduled post exists and belongs to user
      const posts = await getScheduledPosts(ctx.user.id);
      const scheduledPost = posts.find((p) => p.id === input.id);

      if (!scheduledPost) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled post not found",
        });
      }

      // Only allow retry on failed or reconnect_required posts
      if (!["failed", "reconnect_required"].includes(scheduledPost.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only retry failed or reconnect_required posts",
        });
      }

      // Reset to scheduled status so worker picks it up
      await updateScheduledPost(input.id, {
        status: "scheduled",
        nextRetryAt: null,
        lastError: null,
        updatedAt: new Date().toISOString(),
      });

      return { success: true };
    }),

  /**
   * Cancel a scheduled post
   * 
   * Only allows cancellation of:
   * - scheduled posts
   * - reconnect_required posts
   * 
   * Cannot cancel posts that are already publishing or published
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify scheduled post exists and belongs to user
      const posts = await getScheduledPosts(ctx.user.id);
      const scheduledPost = posts.find((p) => p.id === input.id);

      if (!scheduledPost) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduled post not found",
        });
      }

      // Can only cancel scheduled or reconnect_required posts
      if (!["scheduled", "reconnect_required"].includes(scheduledPost.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only cancel scheduled or reconnect_required posts",
        });
      }

      // Mark as cancelled
      await updateScheduledPost(input.id, {
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      });

      return { success: true };
    }),
});
