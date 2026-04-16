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
        console.log('\n\n========== SAVE DRAFT FLOW START ==========');
        console.log('[content.create] STEP 1: FRONTEND PAYLOAD');
        console.log('  title:', input.title);
        console.log('  caption length:', input.caption?.length);
        console.log('  caption preview:', input.caption?.substring(0, 200));
        console.log('  hashtags length:', input.hashtags?.length);
        console.log('  hashtags preview:', input.hashtags?.substring(0, 150));
        const cleanCaption = input.caption ? extractCleanCaption(input.caption) : undefined;
        const normalizedHashtags = normalizeHashtags(input.hashtags);
        console.log('\n[content.create] STEP 3: AFTER CLEANING');
        console.log('  cleanCaption length:', cleanCaption?.length);
        console.log('  cleanCaption preview:', cleanCaption?.substring(0, 200));
        console.log('  normalizedHashtags:', normalizedHashtags);
        const dbData = {
          ...input,
          caption: cleanCaption,
          hashtags: normalizedHashtags,
          authorId: ctx.user.id,
          status: "approved" as const,
          aiGeneratedImage: input.aiGeneratedImage ? 1 : (input.aiGeneratedImage === false ? 0 : undefined),
        };
        console.log('\n[content.create] STEP 4: DB PAYLOAD');
        console.log('  caption to save:', dbData.caption?.substring(0, 200));
        console.log('  hashtags to save:', dbData.hashtags);
        
        const result = await createContentPost(dbData);
        
        console.log('\n[content.create] STEP 5: DATABASE RESULT');
        console.log('  saved id:', (result as any)?.id);
        console.log('  saved caption:', (result as any)?.caption?.substring(0, 200));
        console.log('  saved hashtags:', (result as any)?.hashtags);
        console.log('========== SAVE DRAFT FLOW END ==========\n\n');
        
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
  "caption": "The main caption text (keep it engaging and multi-paragraph if needed)",
  "hashtags": "Exactly 5 hashtags separated by spaces, e.g., #tag1 #tag2 #tag3 #tag4 #tag5",
  "script": "Video script if applicable",
  "ideas": ["idea1", "idea2", "idea3"],
  "fullPost": "Complete post with caption and hashtags"
}

Do NOT include metadata, status, image URLs, or tone descriptors in the output.`;

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
                  hashtags: { type: "string" },
                  script: { type: "string" },
                  ideas: { type: "array", items: { type: "string" } },
                  fullPost: { type: "string" },
                },
                required: ["caption", "hashtags"],
              },
            },
          },
        });

        const messageContent = response.choices[0].message.content;
        const contentStr = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
        const content = JSON.parse(contentStr);
        return { data: content };
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

  // ─── Nested Routers ───────────────────────────────────────────────────────
  schedule: scheduleRouter,
  connections: connectionsRouter,
});

export type AppRouter = typeof appRouter;
