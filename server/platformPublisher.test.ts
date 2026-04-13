import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { publishToFacebook, PostContent } from "./platformPublisher";

describe("Facebook Publisher - Image Upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should publish text-only post without image", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "post_123" }),
    });

    const post: PostContent = {
      title: "Test Post",
      caption: "This is a test post",
      hashtags: "#test #facebook",
    };

    const result = await publishToFacebook(post, {
      accessToken: "test_token",
      pageId: "123456",
    });

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("post_123");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/feed"),
      expect.any(Object)
    );
  });

  it("should upload image and attach to post when imageUrl provided", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    // First call: image fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map([["content-type", "image/jpeg"]]),
      arrayBuffer: async () => new ArrayBuffer(1000),
    });

    // Second call: image upload to Facebook
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "photo_456" }),
    });

    // Third call: feed post creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "post_789" }),
    });

    const post: PostContent = {
      title: "Test Post with Image",
      caption: "This is a test post with an image",
      hashtags: "#test #facebook",
      imageUrl: "https://example.com/image.jpg",
    };

    const result = await publishToFacebook(post, {
      accessToken: "test_token",
      pageId: "123456",
    });

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("post_789");
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify image was uploaded to photos endpoint
    const photoUploadCall = mockFetch.mock.calls[1];
    expect(photoUploadCall[0]).toContain("/photos");
    expect(photoUploadCall[1].method).toBe("POST");

    // Verify feed post includes object_attachment
    const feedPostCall = mockFetch.mock.calls[2];
    expect(feedPostCall[0]).toContain("/feed");
    const feedBody = JSON.parse(feedPostCall[1].body);
    expect(feedBody.object_attachment).toBe("photo_456");
  });

  it("should continue with text-only post if image upload fails", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    // First call: image fetch fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    // Second call: feed post creation (should still succeed)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "post_xyz" }),
    });

    const post: PostContent = {
      title: "Test Post with Missing Image",
      caption: "This is a test post",
      hashtags: "#test",
      imageUrl: "https://example.com/missing.jpg",
    };

    const result = await publishToFacebook(post, {
      accessToken: "test_token",
      pageId: "123456",
    });

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe("post_xyz");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify feed post does NOT include object_attachment
    const feedPostCall = mockFetch.mock.calls[1];
    const feedBody = JSON.parse(feedPostCall[1].body);
    expect(feedBody.object_attachment).toBeUndefined();
  });

  it("should handle Facebook API errors properly", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 190,
          message: "Invalid access token",
        },
      }),
    });

    const post: PostContent = {
      title: "Test Post",
      caption: "This is a test post",
    };

    const result = await publishToFacebook(post, {
      accessToken: "invalid_token",
      pageId: "123456",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("TOKEN_EXPIRED");
  });

  it("should handle rate limiting", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: "Rate limit exceeded",
        },
      }),
    });

    const post: PostContent = {
      title: "Test Post",
      caption: "This is a test post",
    };

    const result = await publishToFacebook(post, {
      accessToken: "test_token",
      pageId: "123456",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("RATE_LIMITED");
  });
});
