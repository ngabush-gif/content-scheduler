import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { publishToFacebook, PostContent } from "./platformPublisher";

/**
 * End-to-End Test: Image Publishing to Facebook
 * 
 * This test simulates the complete flow:
 * 1. User creates content with an image URL (from S3 or AI generation)
 * 2. Content is scheduled for publishing
 * 3. Publishing worker picks up the job
 * 4. Image is uploaded to Facebook
 * 5. Post is created with image attached
 * 6. Post appears on Facebook page with image
 */

describe("E2E: Image Publishing to Facebook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should complete full image publishing flow", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Simulate the complete flow:
    // 1. Image fetch from S3/CDN
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map([["content-type", "image/jpeg"]]),
      arrayBuffer: async () => {
        // Simulate a real image buffer (1KB of data)
        const buffer = new ArrayBuffer(1024);
        return buffer;
      },
    });

    // 2. Facebook photo upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "123456789_987654321", // Facebook photo ID
      }),
    });

    // 3. Facebook feed post creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "123456789_111222333", // Facebook post ID
      }),
    });

    // Simulate content post with image
    const post: PostContent = {
      title: "Time Freedom Tips",
      caption:
        "Here are 5 ways to achieve time freedom and work-life balance. Start with these simple steps today!",
      hashtags: "#TimeWorth #Freedom #Balance #Lifestyle #Success",
      imageUrl: "https://cdn.manus.im/user-123/2026-04-13-abc123-post-image.jpg",
      mediaType: "image",
    };

    // Execute publishing
    const result = await publishToFacebook(post, {
      accessToken: "EAAB...", // Real page access token
      pageId: "838862115974989", // Time Wealth with Leon Makara
    });

    // Verify success
    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("123456789_111222333");

    // Verify all steps were called
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify image was fetched
    const imageFetchCall = mockFetch.mock.calls[0];
    expect(imageFetchCall[0]).toContain("cdn.manus.im");

    // Verify photo upload to Facebook
    const photoUploadCall = mockFetch.mock.calls[1];
    expect(photoUploadCall[0]).toContain("graph.facebook.com");
    expect(photoUploadCall[0]).toContain("/photos");
    expect(photoUploadCall[1].method).toBe("POST");

    // Verify feed post includes photo attachment
    const feedPostCall = mockFetch.mock.calls[2];
    expect(feedPostCall[0]).toContain("/feed");
    const feedBody = JSON.parse(feedPostCall[1].body);
    // buildPostText uses caption first, then hashtags
    expect(feedBody.message).toContain("Here are 5 ways to achieve time freedom");
    expect(feedBody.object_attachment).toBe("123456789_987654321");
  });

  it("should handle AI-generated images", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    // 1. Fetch AI-generated image from Manus API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map([["content-type", "image/png"]]),
      arrayBuffer: async () => {
        const buffer = new ArrayBuffer(2048);
        return buffer;
      },
    });

    // 2. Facebook photo upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "photo_ai_generated_123",
      }),
    });

    // 3. Facebook feed post creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "post_ai_generated_456",
      }),
    });

    const post: PostContent = {
      title: "AI-Generated Content Post",
      caption: "This post was created with AI assistance",
      hashtags: "#AI #ContentCreation #Automation #Social",
      imageUrl: "https://api.manus.im/images/generated/ai-image-2026-04-13.png",
      mediaType: "image",
    };

    const result = await publishToFacebook(post, {
      accessToken: "EAAB...",
      pageId: "838862115974989",
    });

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("post_ai_generated_456");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should handle multiple posts with images sequentially", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const posts: PostContent[] = [
      {
        title: "Post 1",
        caption: "First post",
        hashtags: "#one",
        imageUrl: "https://example.com/image1.jpg",
      },
      {
        title: "Post 2",
        caption: "Second post",
        hashtags: "#two",
        imageUrl: "https://example.com/image2.jpg",
      },
    ];

    // Setup mocks for both posts
    for (let i = 0; i < 2; i++) {
      // Image fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "image/jpeg"]]),
        arrayBuffer: async () => {
          const buffer = new ArrayBuffer(1024);
          return buffer;
        },
      });

      // Photo upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: `photo_${i}`,
        }),
      });

      // Feed post
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: `post_${i}`,
        }),
      });
    }

    // Publish posts sequentially to ensure mocks are consumed in order
    const results = [];
    for (const post of posts) {
      const result = await publishToFacebook(post, {
        accessToken: "EAAB...",
        pageId: "838862115974989",
      });
      results.push(result);
    }

    // Verify both succeeded
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    // Posts should have IDs from the feed post responses
    expect(results[0].platformPostId).toBeDefined();
    expect(results[1].platformPostId).toBeDefined();

    // Verify all 6 calls were made (3 per post)
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it("should log image upload progress", async () => {
    const mockFetch = vi.fn();
    const consoleSpy = vi.spyOn(console, "log");
    global.fetch = mockFetch;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map([["content-type", "image/jpeg"]]),
      arrayBuffer: async () => {
        const buffer = new ArrayBuffer(5000);
        return buffer;
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "photo_123",
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "post_456",
      }),
    });

    const post: PostContent = {
      title: "Test",
      caption: "Test post",
      imageUrl: "https://example.com/image.jpg",
    };

    await publishToFacebook(post, {
      accessToken: "token",
      pageId: "123456",
    });

    // Verify logging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Facebook] Fetching image from")
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Facebook] Image fetched: 5000 bytes")
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Facebook] Uploading image to")
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Facebook] Image uploaded successfully")
    );

    consoleSpy.mockRestore();
  });
});
