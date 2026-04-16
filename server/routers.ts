import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createContentPost,
  updateContentPost,
  getContentPostById,
  getContentPostsByAuthor,
  getAllContentPosts,
  deleteContentPost,
  createScheduledPost,
  getScheduledPosts,
  updateScheduledPost,
  deleteScheduledPost,
  getConnectionWithCredentials,
  getPlatformConnectionById,
  markInviteCodeAsUsed,
} from "./db";
import { publishToFacebook, publishToInstagram, publishToTikTok } from "./platformPublisher";
import { generateAIImage, uploadMediaFile, validateUploadedFile } from "./imageHandler";
import { scheduleRouter } from "./scheduleRouter";
import { connectionsRouter } from "./connectionsRouter";

// ─── Hashtag utilities ────────────────────────────────────────────────────────
/**
 * Extract hashtags from messy LLM output - returns exactly 5
 */
function extractHashtags(text: string): string[] {
  if (!text) return [];
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const found = text.match(hashtagRegex) || [];
  const deduped = Array.from(new Set(found.map(h => h.toLowerCase())));
  return deduped.slice(0, 5);
}

/**
 * Extract clean caption from messy LLM output
 * Removes hashtags, URLs, metadata, and status text
 * PRESERVES all paragraphs and line breaks
 */
function extractCleanCaption(text: string): string {
  console.log('[extractCleanCaption] RAW INPUT (first 500 chars):', JSON.stringify(text.substring(0, 500)));
  if (!text) return '';
  
  // Remove URLs (image/video links)
  let clean = text.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove hashtags
  clean = clean.replace(/#[a-zA-Z0-9_]+\s*/g, '');
  
  // Remove metadata patterns (approved, pending, image, video, etc) - only as standalone words
  clean = clean.replace(/\b(approved|pending|draft|image|video|none)\b,?\s*/gi, '');
  
  // Remove tone/style descriptors in parentheses
  clean = clean.replace(/\([^)]*\)/g, '');
  
  // Process line by line, removing ONLY metadata lines
  const lines = clean.split('\n');
  const cleanedLines = lines
    .map(line => {
      const trimmed = line.trim();
      
      // Skip lines that are ONLY metadata
      if (/^(Real|Encouraging|Relatable|Motivational|Engaging|Tips|Values)\s*(&|\()?/.test(trimmed)) return '';
      if (/^[A-Z][a-z]+ & [a-z]+$/.test(trimmed)) return ''; // "Real & grounded"
      
      // Keep caption lines
      return line;
    })
    .filter(line => line.trim().length > 0) // Remove empty lines
    .join('\n');
  
  // Clean up multiple consecutive spaces (but preserve newlines)
  let result = cleanedLines.replace(/ {2,}/g, ' ');
  
  // Remove trailing commas at end of lines
  result = result.replace(/,\s*$/gm, '');
  
  // Trim overall but preserve internal structure
  result = result.trim();
  
  console.log('[extractCleanCaption] CLEANED OUTPUT (first 500 chars):', JSON.stringify(result.substring(0, 500)));
  console.log('[extractCleanCaption] Total length: input=' + text.length + ', output=' + result.length);
  return result;
}

/**
 * Ensure exactly 5 hashtags
 */
function normalizeHashtags(hashtags: string | string[] | undefined): string {
  console.log('[normalizeHashtags] INPUT type:', typeof hashtags, 'value (first 200 chars):', typeof hashtags === 'string' ? hashtags.substring(0, 200) : JSON.stringify(hashtags));
  if (!hashtags) return '';
  let tags: string[] = [];
  if (typeof hashtags === 'string') {
    tags = extractHashtags(hashtags);
  } else if (Array.isArray(hashtags)) {
    tags = hashtags.map(h => h.toLowerCase().startsWith('#') ? h : `#${h}`);
  }
  console.log('[normalizeHashtags] EXTRACTED TAGS:', tags);
  tags = tags.slice(0, 5);
  while (tags.length < 5) {
    tags.push(`#tag${tags.length + 1}`);
  }
  const result = tags.join(' ');
  console.log('[normalizeHashtags] FINAL OUTPUT:', result, '(count:', tags.length + ')');
  return result;
}

// ─── Admin guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

// ─── Main Router ──────────────────────────────────────────────────────────────
export const appRouter = router({
  // ─── Content Management ───────────────────────────────────────────────────
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
          imagePrompt: z.string().optional(),
          script: z.string().optional(),
          ideas: z.string().optional(),
          fullContent: z.string().optional(),
          tone: z.string().optional(),
          tags: z.string().optional(),
          imageUrl: z.string().optional(),
          aiGeneratedImage: z.boolean().optional(),
          mediaType: z.enum(["none", "image", "video"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        console.log('\n\n========== BACKEND SAVE DRAFT FLOW START ==========');
        console.log('[content.create] STEP 1: FRONTEND PAYLOAD (already parsed & validated)');
        console.log('  title:', input.title);
        console.log('  caption:', input.caption?.substring(0, 300));
        console.log('  hashtags:', input.hashtags);
        console.log('  imagePrompt:', input.imagePrompt?.substring(0, 300));
        
        // NO CLEANUP - fields are already clean from frontend
        const dbData: any = {
          authorId: ctx.user.id,
          title: input.title,
          niche: input.niche,
          platform: input.platform,
          contentType: input.contentType,
          status: "draft" as const,
          caption: input.caption,
          hashtags: Array.isArray(input.hashtags) ? input.hashtags : (typeof input.hashtags === 'string' ? input.hashtags.split(' ') : []),
          imagePrompt: input.imagePrompt,
          script: input.script,
          ideas: input.ideas,
          fullContent: input.fullContent,
          tone: input.tone,
          tags: input.tags,
          imageUrl: input.imageUrl,
          aiGeneratedImage: input.aiGeneratedImage ? 1 : (input.aiGeneratedImage === false ? 0 : undefined),
          mediaType: input.mediaType,
        };
        // Remove undefined fields to avoid database errors
        Object.keys(dbData).forEach((key: string) => {
          if (dbData[key] === undefined) delete dbData[key];
        });
        
        console.log('\n[content.create] STEP 2: FINAL DB PAYLOAD (no cleanup applied)');
        console.log('  caption:', dbData.caption?.substring(0, 300));
        console.log('  hashtags (type):', typeof dbData.hashtags, 'value:', JSON.stringify(dbData.hashtags));
        console.log('  imagePrompt:', dbData.imagePrompt?.substring(0, 300));
        
        const result = await createContentPost(dbData);
        
        console.log('\n[content.create] STEP 3: DATABASE RESULT');
        console.log('  saved id:', (result as any)?.id);
        console.log('  saved caption:', (result as any)?.caption?.substring(0, 300));
        console.log('  saved hashtags:', (result as any)?.hashtags);
        console.log('  saved imagePrompt:', (result as any)?.imagePrompt?.substring(0, 300));
        console.log('========== BACKEND SAVE DRAFT FLOW END ==========\n\n');
        
        return result;
      }),

    list: protectedProcedure
      .input(
        z.object({
          status: z.enum(["pending", "approved", "rejected"]).optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        return getContentPostsByAuthor(ctx.user.id);
      }),

    get: protectedProcedure
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
          imageUrl: z.string().optional(),
          aiGeneratedImage: z.boolean().optional(),
          mediaType: z.enum(["none", "image", "video"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && post.authorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const { id, ...data } = input;
        const cleanCaption = data.caption ? extractCleanCaption(data.caption) : undefined;
        const normalizedHashtags = data.hashtags ? normalizeHashtags(data.hashtags) : undefined;
        const dbData = {
          ...data,
          caption: cleanCaption !== undefined ? cleanCaption : data.caption,
          hashtags: normalizedHashtags !== undefined ? normalizedHashtags : data.hashtags,
          aiGeneratedImage: data.aiGeneratedImage ? 1 : (data.aiGeneratedImage === false ? 0 : undefined),
        };
        await updateContentPost(id, dbData);
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
        if (ctx.user.role !== "admin" && post.authorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Update post status to pending review
        await updateContentPost(input.id, { status: 'pending_review' });
        return { success: true };
      }),
  }),

  // ─── Admin Approval ───────────────────────────────────────────────────────
  admin: router({
    approveContent: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        await updateContentPost(input.id, { status: 'approved' });
        return { success: true };
      }),

    rejectContent: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string() }))
      .mutation(async ({ input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        await updateContentPost(input.id, { status: 'rejected' });
        return { success: true };
      }),
  }),

  // ─── Generation ────────────────────────────────────────────────────────────
  generate: router({
    content: protectedProcedure
      .input(
        z.object({
          niche: z.enum(["time_freedom", "parents", "side_hustlers", "online_business", "cultural", "over_50", "scam_survivors"]),
          platform: z.enum(["facebook", "instagram", "tiktok", "all"]),
          contentType: z.enum(["caption", "script", "hashtags", "ideas", "full_post"]),
          topic: z.string().optional(),
          customTone: z.string().optional(),
          contentStyle: z.enum(["motivational", "engagement", "personal_story", "curiosity", "opportunity", "tips_values"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        const { NICHES } = await import("../shared/niches");

        const niche = NICHES.find((n) => n.id === input.niche);
        if (!niche) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid niche" });

        const prompt = `You are a social media content expert. Generate engaging ${input.platform} content for the "${niche.label}" audience.

Topic: ${input.topic || "general"}
Content Type: ${input.contentType}
Tone: ${input.customTone || niche.tone}
Style: ${input.contentStyle || "motivational"}

Generate ONLY the content. Return a JSON object with these fields:
{
  "caption": "The main caption text (keep it engaging and multi-paragraph if needed). MUST NOT contain any hashtags.",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "imagePrompt": "A detailed prompt for generating an image that matches the caption"
}

IMPORTANT:
- caption: Clean text only, NO hashtags, NO URLs, NO metadata
- hashtags: Array of exactly 5 hashtags (without # symbol)
- imagePrompt: Detailed visual description for image generation
- Do NOT include metadata, status, image URLs, or tone descriptors
- Do NOT include any extra fields or explanations`;

        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "content",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  caption: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" },  },
                  imagePrompt: { type: "string" },
                },
                required: ["caption", "hashtags", "imagePrompt"],
              },
            },
          },
        });

        // ─── DEFENSIVE ERROR HANDLING ───
        console.log('[generate.content] RAW RESPONSE:', JSON.stringify(response, null, 2));
        
        // Validate response structure
        if (!response || !response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
          console.error('[generate.content] ERROR: Invalid LLM response structure');
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'LLM returned invalid response structure' });
        }
        
        const choice = response.choices[0];
        if (!choice || !choice.message) {
          console.error('[generate.content] ERROR: Missing choice or message in response');
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'LLM response missing message' });
        }
        
        const messageContent = choice.message.content;
        console.log('[generate.content] RAW LLM OUTPUT:', JSON.stringify(messageContent, null, 2));
        
        if (!messageContent) {
          console.error('[generate.content] ERROR: Empty message content');
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'LLM returned empty content' });
        }
        
        // Parse JSON safely
        let content: any;
        try {
          const contentStr = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
          content = JSON.parse(contentStr);
          console.log('[generate.content] PARSED JSON:', JSON.stringify(content, null, 2));
        } catch (parseErr) {
          console.error('[generate.content] JSON PARSE ERROR:', parseErr, 'Raw content:', messageContent);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to parse LLM response as JSON' });
        }
        
        // ─── NORMALIZE & VALIDATE STRUCTURE ───
        const normalized = {
          caption: '',
          hashtags: [] as string[],
          imagePrompt: '',
        };
        
        // Validate caption
        if (typeof content.caption === 'string' && content.caption.trim()) {
          normalized.caption = content.caption.trim();
        } else {
          console.warn('[generate.content] WARNING: caption is missing or not a string, using empty string');
        }
        
        // Validate hashtags
        if (Array.isArray(content.hashtags) && content.hashtags.length > 0) {
          normalized.hashtags = content.hashtags
            .slice(0, 5)
            .map((tag: any) => String(tag).replace(/^#+/, '').trim())
            .filter((tag: string) => tag.length > 0);
          
          // Pad with defaults if needed
          while (normalized.hashtags.length < 5) {
            normalized.hashtags.push(`tag${normalized.hashtags.length + 1}`);
          }
        } else {
          console.warn('[generate.content] WARNING: hashtags is missing or not an array, using defaults');
          normalized.hashtags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
        }
        
        // Validate imagePrompt
        if (typeof content.imagePrompt === 'string' && content.imagePrompt.trim()) {
          normalized.imagePrompt = content.imagePrompt.trim();
        } else {
          console.warn('[generate.content] WARNING: imagePrompt is missing or not a string, using default');
          normalized.imagePrompt = 'A professional image related to the caption';
        }
        
        console.log('[generate.content] NORMALIZED & VALIDATED:', JSON.stringify(normalized, null, 2));
        console.log('[generate.content] FINAL PAYLOAD TO FRONTEND:', JSON.stringify(normalized, null, 2));
        
        return { data: normalized };
      }),
  }),

  // ─── Media ────────────────────────────────────────────────────────────────
  media: router({
    generateImage: protectedProcedure
      .input(z.object({ prompt: z.string() }))
      .mutation(async ({ input }) => {
        const { generateImage } = await import("./_core/imageGeneration");
        const result = await generateImage({ prompt: input.prompt });
        return result;
      }),

    uploadFile: protectedProcedure
      .input(z.object({ fileName: z.string(), fileData: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileData, "base64");
        const result = await uploadMediaFile(buffer, input.fileName, "application/octet-stream", ctx.user.id);
        return result;
      }),
  }),

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      return ctx.user;
    }),

    logout: protectedProcedure.mutation(async ({ ctx }) => {
      ctx.res?.clearCookie("session");
      return { success: true };
    }),
  }),

  // ─── Approval Workflow ───────────────────────────────────────────────────────
  approval: router({
    pending: adminProcedure
      .query(async () => {
        const posts = await getAllContentPosts({ status: 'pending_review' });
        return posts || [];
      }),

    approve: adminProcedure
      .input(z.object({ id: z.number(), note: z.string().optional() }))
      .mutation(async ({ input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        await updateContentPost(input.id, { status: 'approved' });
        return { success: true };
      }),

    reject: adminProcedure
      .input(z.object({ id: z.number(), note: z.string() }))
      .mutation(async ({ input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        await updateContentPost(input.id, { status: 'rejected' });
        return { success: true };
      }),

    requestRevision: adminProcedure
      .input(z.object({ id: z.number(), note: z.string() }))
      .mutation(async ({ input }) => {
        const post = await getContentPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND' });
        await updateContentPost(input.id, { status: 'draft' });
        return { success: true };
      }),
  }),

  // ─── Analytics ───────────────────────────────────────────────────────────────
  analytics: router({
    summary: protectedProcedure
      .query(async ({ ctx }) => {
        const posts = await getAllContentPosts();
        const userPosts = posts.filter(p => p.authorId === ctx.user.id);
        const isAdmin = ctx.user.role === 'admin';
        const postsToAnalyze = isAdmin ? posts : userPosts;
        
        return {
          totalPosts: postsToAnalyze.length,
          byStatus: {
            draft: postsToAnalyze.filter(p => p.status === 'draft').length,
            pending_review: postsToAnalyze.filter(p => p.status === 'pending_review').length,
            approved: postsToAnalyze.filter(p => p.status === 'approved').length,
            rejected: postsToAnalyze.filter(p => p.status === 'rejected').length,
            published: postsToAnalyze.filter(p => p.status === 'published').length,
          },
          byNiche: {},
          byPlatform: {},
        };
      }),
  }),

  // ─── Nested Routers ───────────────────────────────────────────────────────
  schedule: scheduleRouter,
  connections: connectionsRouter,
});

export type AppRouter = typeof appRouter;
