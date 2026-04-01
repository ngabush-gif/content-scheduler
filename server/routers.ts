import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { NICHES, PLATFORMS } from "../shared/niches";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addApprovalHistory,
  addPublishLog,
  createContentPost,
  createScheduledPost,
  deleteContentPost,
  deleteScheduledPost,
  disconnectPlatform,
  getAllContentPosts,
  getAllUsers,
  getAnalyticsSummary,
  getApprovalHistoryByPost,
  getContentPostById,
  getContentPostsByAuthor,
  getPlatformConnectionWithToken,
  getPlatformConnections,
  getPublishLog,
  getScheduledPosts,
  updateContentPost,
  updateScheduledPost,
  updateUserRole,
  upsertPlatformConnection,
} from "./db";
import { publishToFacebook, publishToInstagram, publishToTikTok } from "./platformPublisher";

// ─── Admin guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  // ─── Auth ────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Team / Users ─────────────────────────────────────────────────────────
  team: router({
    list: protectedProcedure.query(async () => {
      return getAllUsers();
    }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        await updateUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),

  // ─── Niches & Platforms (static config) ──────────────────────────────────
  config: router({
    niches: publicProcedure.query(() => NICHES),
    platforms: publicProcedure.query(() => PLATFORMS),
  }),

  // ─── Content Posts ────────────────────────────────────────────────────────
  content: router({
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          niche: z.enum(["time_freedom", "parents", "side_hustlers", "online_business", "cultural", "over_50", "scam_survivors"]),
          platform: z.enum(["facebook", "instagram", "tiktok", "all"]),
          contentType: z.enum(["caption", "script", "hashtags", "ideas", "full_post"]),
          caption: z.string().optional(),
          hashtags: z.string().optional(),
          script: z.string().optional(),
          ideas: z.string().optional(),
          fullContent: z.string().optional(),
          tone: z.string().optional(),
          tags: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await createContentPost({ ...input, authorId: ctx.user.id, status: "draft" });
        return result;
      }),

    list: protectedProcedure
      .input(
        z.object({
          status: z.string().optional(),
          niche: z.string().optional(),
          platform: z.string().optional(),
          isLibraryItem: z.boolean().optional(),
          myOnly: z.boolean().optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        if (input?.myOnly) {
          return getContentPostsByAuthor(ctx.user.id);
        }
        if (ctx.user.role === "user" && !input?.isLibraryItem) {
          return getContentPostsByAuthor(ctx.user.id);
        }
        return getAllContentPosts(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && post.authorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return post;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          caption: z.string().optional(),
          hashtags: z.string().optional(),
          script: z.string().optional(),
          ideas: z.string().optional(),
          fullContent: z.string().optional(),
          tone: z.string().optional(),
          tags: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && post.authorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const { id, ...data } = input;
        await updateContentPost(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && post.authorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await deleteContentPost(input.id);
        return { success: true };
      }),

    submitForReview: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        if (post.authorId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await updateContentPost(input.id, { status: "pending_review" });
        await addApprovalHistory({ postId: input.id, reviewerId: ctx.user.id, action: "submitted" });
        return { success: true };
      }),

    saveToLibrary: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        if (post.status !== "approved" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only approved posts can be saved to library" });
        }
        await updateContentPost(input.id, { isLibraryItem: true });
        return { success: true };
      }),

    approvalHistory: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ input }) => {
        return getApprovalHistoryByPost(input.postId);
      }),
  }),

  // ─── Approval Workflow ────────────────────────────────────────────────────
  approval: router({
    pending: adminProcedure.query(async () => {
      return getAllContentPosts({ status: "pending_review" });
    }),

    approve: adminProcedure
      .input(z.object({ id: z.number(), note: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        await updateContentPost(input.id, {
          status: "approved",
          approvedById: ctx.user.id,
          approvedAt: new Date(),
        });
        await addApprovalHistory({
          postId: input.id,
          reviewerId: ctx.user.id,
          action: "approved",
          note: input.note,
        });
        return { success: true };
      }),

    reject: adminProcedure
      .input(z.object({ id: z.number(), note: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await updateContentPost(input.id, { status: "rejected", rejectionNote: input.note });
        await addApprovalHistory({
          postId: input.id,
          reviewerId: ctx.user.id,
          action: "rejected",
          note: input.note,
        });
        return { success: true };
      }),

    requestRevision: adminProcedure
      .input(z.object({ id: z.number(), note: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await updateContentPost(input.id, { status: "draft", rejectionNote: input.note });
        await addApprovalHistory({
          postId: input.id,
          reviewerId: ctx.user.id,
          action: "revision_requested",
          note: input.note,
        });
        return { success: true };
      }),
  }),

  // ─── AI Content Generation ────────────────────────────────────────────────
  generate: router({
    content: protectedProcedure
      .input(
        z.object({
          niche: z.enum(["time_freedom", "parents", "side_hustlers", "online_business", "cultural", "over_50", "scam_survivors"]),
          platform: z.enum(["facebook", "instagram", "tiktok", "all"]),
          contentType: z.enum(["caption", "script", "hashtags", "ideas", "full_post"]),
          topic: z.string().optional(),
          customTone: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const niche = NICHES.find((n) => n.id === input.niche);
        const platform = PLATFORMS.find((p) => p.id === input.platform);

        const platformContext = platform
          ? `Platform: ${platform.label}. Best practices: ${platform.bestPractices}`
          : "Platform: All platforms";

        const nicheContext = niche
          ? `Audience: ${niche.label} - ${niche.description}. Tone guide: ${niche.promptHint}`
          : "";

        const topicContext = input.topic ? `Topic/focus: ${input.topic}` : "Choose a relevant topic for this audience";
        const toneOverride = input.customTone ? `Additional tone instruction: ${input.customTone}` : "";

        let systemPrompt = `You are an expert social media content creator specializing in online business, digital marketing, and personal development content. You create authentic, engaging content that resonates deeply with specific audiences.

${nicheContext}
${platformContext}
${toneOverride}

Always create content that:
- Feels authentic and human, never salesy or fake
- Provides genuine value to the audience
- Matches the platform's style and best practices
- Uses the appropriate tone for the specific audience segment
- Includes a clear call-to-action when appropriate`;

        let userPrompt = "";
        let responseSchema: any = null;

        if (input.contentType === "caption") {
          userPrompt = `${topicContext}

Create an engaging social media caption for ${platform?.label || "social media"} targeting ${niche?.label || "this audience"}.

Return JSON with:
- caption: the main post caption (platform-appropriate length)
- hook: the opening line that grabs attention
- cta: the call-to-action
- characterCount: approximate character count`;

          responseSchema = {
            type: "json_schema",
            json_schema: {
              name: "caption_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  caption: { type: "string" },
                  hook: { type: "string" },
                  cta: { type: "string" },
                  characterCount: { type: "number" },
                },
                required: ["caption", "hook", "cta", "characterCount"],
                additionalProperties: false,
              },
            },
          };
        } else if (input.contentType === "hashtags") {
          userPrompt = `${topicContext}

Generate EXACTLY 5 hashtags for ${platform?.label || "social media"} targeting ${niche?.label || "this audience"}.

IMPORTANT: These 5 hashtags must:
1. Match the caption style and theme of the post
2. Reflect the tone and audience of the ${niche?.label || "audience"}
3. Be highly relevant and authentic (not generic)
4. Mix niche-specific and broader hashtags for reach
5. Feel natural with the content, not forced

Return JSON with:
- hashtags: array of exactly 5 hashtags that match the caption tone and theme
- fullSet: all 5 hashtags as a single string ready to post`;

          responseSchema = {
            type: "json_schema",
            json_schema: {
              name: "hashtags_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  hashtags: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
                  fullSet: { type: "string" },
                },
                required: ["hashtags", "fullSet"],
                additionalProperties: false,
              },
            },
          };
        } else if (input.contentType === "script") {
          userPrompt = `${topicContext}

Write a compelling video script for ${platform?.label || "social media"} targeting ${niche?.label || "this audience"}.

Return JSON with:
- hook: opening 3-5 seconds to grab attention
- intro: brief intro (5-10 seconds)
- mainContent: the core message broken into sections (array of strings)
- cta: closing call-to-action
- estimatedDuration: estimated video length in seconds
- fullScript: complete script as one string`;

          responseSchema = {
            type: "json_schema",
            json_schema: {
              name: "script_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  hook: { type: "string" },
                  intro: { type: "string" },
                  mainContent: { type: "array", items: { type: "string" } },
                  cta: { type: "string" },
                  estimatedDuration: { type: "number" },
                  fullScript: { type: "string" },
                },
                required: ["hook", "intro", "mainContent", "cta", "estimatedDuration", "fullScript"],
                additionalProperties: false,
              },
            },
          };
        } else if (input.contentType === "ideas") {
          userPrompt = `${topicContext}

Generate 8 creative content ideas for ${platform?.label || "social media"} targeting ${niche?.label || "this audience"}.

Return JSON with:
- ideas: array of 8 objects, each with title, description, contentFormat (post/reel/story/carousel), and engagementTip`;

          responseSchema = {
            type: "json_schema",
            json_schema: {
              name: "ideas_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  ideas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        contentFormat: { type: "string" },
                        engagementTip: { type: "string" },
                      },
                      required: ["title", "description", "contentFormat", "engagementTip"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["ideas"],
                additionalProperties: false,
              },
            },
          };
        } else {
          // full_post
          userPrompt = `${topicContext}

Create a complete, ready-to-publish social media post for ${platform?.label || "social media"} targeting ${niche?.label || "this audience"}.

Return JSON with:
- caption: the main post caption
- hook: opening hook line
- hashtags: relevant hashtags as a single string
- cta: call-to-action
- postIdea: brief description of accompanying visual/video
- fullPost: the complete formatted post ready to copy-paste`;

          responseSchema = {
            type: "json_schema",
            json_schema: {
              name: "full_post_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  caption: { type: "string" },
                  hook: { type: "string" },
                  hashtags: { type: "string" },
                  cta: { type: "string" },
                  postIdea: { type: "string" },
                  fullPost: { type: "string" },
                },
                required: ["caption", "hook", "hashtags", "cta", "postIdea", "fullPost"],
                additionalProperties: false,
              },
            },
          };
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: responseSchema,
        });

        const rawContent = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent));
        return { contentType: input.contentType, data: parsed };
      }),
  }),

  // ─── Scheduling ───────────────────────────────────────────────────────────
  schedule: router({
    create: protectedProcedure
      .input(
        z.object({
          postId: z.number(),
          platform: z.enum(["facebook", "instagram", "tiktok"]),
          scheduledAt: z.number(), // unix ms
        })
      )
      .mutation(async ({ ctx, input }) => {
        const post = await getContentPostById(input.postId);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        if (post.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved posts can be scheduled" });
        }
        const result = await createScheduledPost({
          postId: input.postId,
          scheduledById: ctx.user.id,
          platform: input.platform,
          scheduledAt: new Date(input.scheduledAt),
        });
        await updateContentPost(input.postId, { scheduledAt: new Date(input.scheduledAt) });
        return result;
      }),

    list: protectedProcedure
      .input(
        z.object({
          status: z.string().optional(),
          from: z.number().optional(),
          to: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getScheduledPosts({
          status: input?.status,
          from: input?.from ? new Date(input.from) : undefined,
          to: input?.to ? new Date(input.to) : undefined,
        });
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateScheduledPost(input.id, { status: "cancelled" });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteScheduledPost(input.id);
        return { success: true };
      }),
  }),

  // ─── Publishing ───────────────────────────────────────────────────────────
  publish: router({
    platforms: protectedProcedure.query(async ({ ctx }) => {
      return getPlatformConnections(ctx.user.id);
    }),

    connectPlatform: protectedProcedure
      .input(
        z.object({
          platform: z.enum(["facebook", "instagram", "tiktok"]),
          accountName: z.string(),
          accessToken: z.string(),
          // Instagram: Instagram Business Account ID
          // Facebook: Page ID
          // TikTok: not required (token is sufficient)
          accountId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await upsertPlatformConnection({
          userId: ctx.user.id,
          platform: input.platform,
          accountName: input.accountName,
          accountId: input.accountId,
          accessToken: input.accessToken,
          isActive: true,
        });
        return { success: true };
      }),

    disconnectPlatform: protectedProcedure
      .input(z.object({ platform: z.enum(["facebook", "instagram", "tiktok"]) }))
      .mutation(async ({ ctx, input }) => {
        await disconnectPlatform(ctx.user.id, input.platform);
        return { success: true };
      }),

    testConnection: protectedProcedure
      .input(z.object({ platform: z.enum(["facebook", "instagram", "tiktok"]) }))
      .mutation(async ({ ctx, input }) => {
        const conn = await getPlatformConnectionWithToken(ctx.user.id, input.platform);
        if (!conn || !conn.accessToken) {
          return { success: false, message: "No credentials saved for this platform" };
        }
        try {
          if (input.platform === "instagram") {
            const res = await fetch(
              `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${conn.accessToken}`
            );
            const data = await res.json() as any;
            if (data.error) return { success: false, message: data.error.message };
            return { success: true, message: `Connected as @${data.username}` };
          } else if (input.platform === "facebook") {
            const pageId = conn.accountId;
            const res = await fetch(
              `https://graph.facebook.com/v21.0/${pageId}?fields=id,name&access_token=${conn.accessToken}`
            );
            const data = await res.json() as any;
            if (data.error) return { success: false, message: data.error.message };
            return { success: true, message: `Connected to page: ${data.name}` };
          } else {
            // TikTok: verify token
            const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name", {
              headers: { Authorization: `Bearer ${conn.accessToken}` },
            });
            const data = await res.json() as any;
            if (data.error?.code !== "ok") return { success: false, message: data.error?.message ?? "TikTok auth failed" };
            return { success: true, message: `Connected as ${data.data?.user?.display_name ?? "TikTok user"}` };
          }
        } catch (e: any) {
          return { success: false, message: e?.message ?? "Connection test failed" };
        }
      }),


    post: protectedProcedure
      .input(
        z.object({
          postId: z.number(),
          platforms: z.array(z.enum(["facebook", "instagram", "tiktok"])),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const post = await getContentPostById(input.postId);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        if (post.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved posts can be published" });
        }

        const results: { platform: string; success: boolean; errorMessage?: string; platformPostId?: string }[] = [];

        for (const platform of input.platforms) {
          const conn = await getPlatformConnectionWithToken(ctx.user.id, platform);

          if (!conn || !conn.accessToken) {
            results.push({ platform, success: false, errorMessage: `No ${platform} account connected. Please connect your account in Platform Settings.` });
            await addPublishLog({
              postId: input.postId,
              publishedById: ctx.user.id,
              platform,
              status: "failed",
              errorMessage: "No credentials configured",
            });
            continue;
          }

          let result;
          if (platform === "instagram") {
            result = await publishToInstagram(post, {
              accessToken: conn.accessToken,
              accountId: conn.accountId ?? "",
            });
          } else if (platform === "facebook") {
            result = await publishToFacebook(post, {
              accessToken: conn.accessToken,
              pageId: conn.accountId ?? "",
            });
          } else {
            result = await publishToTikTok(post, { accessToken: conn.accessToken });
          }

          await addPublishLog({
            postId: input.postId,
            publishedById: ctx.user.id,
            platform,
            status: result.success ? "success" : "failed",
            platformPostId: result.platformPostId,
            errorMessage: result.errorMessage,
          });

          results.push({ platform, success: result.success, errorMessage: result.errorMessage, platformPostId: result.platformPostId });
        }

        const anySuccess = results.some((r) => r.success);
        if (anySuccess) {
          await updateContentPost(input.postId, { status: "published", publishedAt: new Date() });
        }

        return { results };
      }),

    log: protectedProcedure
      .input(z.object({ postId: z.number().optional() }))
      .query(async ({ input }) => {
        return getPublishLog(input.postId);
      }),
    schedule: protectedProcedure
      .input(
        z.object({
          postId: z.number(),
          platforms: z.array(z.enum(["facebook", "instagram", "tiktok"])),
          scheduledAt: z.date(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const post = await getContentPostById(input.postId);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        if (post.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved posts can be scheduled" });
        }

        // Validate scheduled time is in the future
        if (input.scheduledAt <= new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Scheduled time must be in the future" });
        }

        // Create scheduled posts for each platform
        for (const platform of input.platforms) {
          await createScheduledPost({
            postId: input.postId,
            scheduledById: ctx.user.id,
            platform: platform as any,
            scheduledAt: input.scheduledAt,
            status: "pending",
          });
        }

        // Update post with scheduled time
        await updateContentPost(input.postId, { scheduledAt: input.scheduledAt });

        return { success: true, message: `Post scheduled for ${input.scheduledAt.toLocaleString()}` };
      }),

  }),

  // ─── Analytics ────────────────────────────────────────────────────────────
  analytics: router({
    summary: protectedProcedure.query(async () => {
      return getAnalyticsSummary();
    }),
  }),
});

export type AppRouter = typeof appRouter;
