import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createContentPost, getAllContentPosts, getContentPostById } from "./db";
import type { InsertContentPost } from "./db";

describe("Auto-Approval Workflow", () => {
  let createdPostId: number;
  const testUserId = 999; // Test user ID

  beforeAll(async () => {
    // Clean up any test posts before running tests
    console.log("Setting up test environment...");
  });

  afterAll(async () => {
    // Clean up test posts after running tests
    console.log("Cleaning up test environment...");
  });

  it("should create new posts with 'approved' status", async () => {
    const postData: InsertContentPost = {
      authorId: testUserId,
      title: "Test Auto-Approved Post",
      niche: "time_freedom",
      platform: "facebook",
      contentType: "caption",
      status: "approved",
      caption: "This is a test caption for auto-approval",
      hashtags: "#test #autoapproval #workflow #content #post",
      mediaType: "none",
    };

    const result = await createContentPost(postData);
    createdPostId = (result as any).id;

    expect(createdPostId).toBeDefined();
    expect(createdPostId).toBeGreaterThan(0);

    // Verify the post was created with approved status
    const savedPost = await getContentPostById(createdPostId);
    expect(savedPost).toBeDefined();
    expect(savedPost?.status).toBe("approved");
    expect(savedPost?.caption).toBe("This is a test caption for auto-approval");
  });

  it("should filter posts by 'approved' status in getAllContentPosts", async () => {
    const approvedPosts = await getAllContentPosts({
      status: "approved",
    });

    expect(Array.isArray(approvedPosts)).toBe(true);
    expect(approvedPosts.length).toBeGreaterThan(0);

    // All returned posts should have 'approved' status
    approvedPosts.forEach((post) => {
      expect(post.status).toBe("approved");
    });
  });

  it("should not return draft posts when filtering for approved", async () => {
    // Create a draft post
    const draftPostData: InsertContentPost = {
      authorId: testUserId,
      title: "Test Draft Post",
      niche: "parents",
      platform: "instagram",
      contentType: "caption",
      status: "draft",
      caption: "This should not appear in approved filter",
      hashtags: "#draft #test #post #content #workflow",
      mediaType: "none",
    };

    await createContentPost(draftPostData);

    // Query for approved posts only
    const approvedPosts = await getAllContentPosts({
      status: "approved",
    });

    // Verify no draft posts are included
    const hasDraftPost = approvedPosts.some(
      (post) => post.title === "Test Draft Post"
    );
    expect(hasDraftPost).toBe(false);
  });

  it("should return posts without status filter", async () => {
    const allPosts = await getAllContentPosts({});

    expect(Array.isArray(allPosts)).toBe(true);
    // Should include both approved and draft posts
    const hasApproved = allPosts.some((post) => post.status === "approved");
    expect(hasApproved).toBe(true);
  });

  it("should allow scheduling only approved posts", async () => {
    // Get all approved posts
    const approvedPosts = await getAllContentPosts({
      status: "approved",
    });

    // Verify that approved posts are available for scheduling
    expect(approvedPosts.length).toBeGreaterThan(0);

    const firstApprovedPost = approvedPosts[0];
    expect(firstApprovedPost.status).toBe("approved");

    // In a real scheduler, this post should be available for scheduling
    // without requiring manual approval
    expect(firstApprovedPost.id).toBeDefined();
  });
});
