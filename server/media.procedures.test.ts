import { describe, it, expect } from "vitest";
import { validateUploadedFile, uploadMediaFile } from "./imageHandler";

describe("Media Procedures", () => {
  const testUserId = 999;

  describe("validateUploadedFile", () => {
    it("should validate correct image files", () => {
      const buffer = Buffer.from("fake image data");
      const result = validateUploadedFile(buffer, "image/jpeg");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject empty files", () => {
      const buffer = Buffer.alloc(0);
      const result = validateUploadedFile(buffer, "image/jpeg");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject unsupported file types", () => {
      const buffer = Buffer.from("fake data");
      const result = validateUploadedFile(buffer, "application/pdf");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unsupported file type");
    });

    it("should reject files exceeding size limit", () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const result = validateUploadedFile(largeBuffer, "image/jpeg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds");
    });

    it("should accept valid video files", () => {
      const buffer = Buffer.from("fake video data");
      const result = validateUploadedFile(buffer, "video/mp4");
      expect(result.valid).toBe(true);
    });

    it("should accept PNG images", () => {
      const buffer = Buffer.from("fake image data");
      const result = validateUploadedFile(buffer, "image/png");
      expect(result.valid).toBe(true);
    });

    it("should accept WebP images", () => {
      const buffer = Buffer.from("fake image data");
      const result = validateUploadedFile(buffer, "image/webp");
      expect(result.valid).toBe(true);
    });

    it("should accept GIF images", () => {
      const buffer = Buffer.from("fake image data");
      const result = validateUploadedFile(buffer, "image/gif");
      expect(result.valid).toBe(true);
    });
  });

  describe("uploadMediaFile", () => {
    it("should upload image file and return URL", async () => {
      const buffer = Buffer.from("fake image data");
      const result = await uploadMediaFile(buffer, "test.jpg", "image/jpeg", testUserId);
      
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
      expect(result.url.length).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it("should include user ID in file path", async () => {
      const buffer = Buffer.from("fake image data");
      const result = await uploadMediaFile(buffer, "test.jpg", "image/jpeg", testUserId);
      
      expect(result.success).toBe(true);
      // URL should contain media path
      expect(result.url).toContain("media");
    });

    it("should handle PNG files", async () => {
      const buffer = Buffer.from("fake image data");
      const result = await uploadMediaFile(buffer, "test.png", "image/png", testUserId);
      
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
    });

    it("should handle WebP files", async () => {
      const buffer = Buffer.from("fake image data");
      const result = await uploadMediaFile(buffer, "test.webp", "image/webp", testUserId);
      
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
    });

    it("should handle MP4 video files", async () => {
      const buffer = Buffer.from("fake video data");
      const result = await uploadMediaFile(buffer, "test.mp4", "video/mp4", testUserId);
      
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
    });

    it("should handle MOV video files", async () => {
      const buffer = Buffer.from("fake video data");
      const result = await uploadMediaFile(buffer, "test.mov", "video/quicktime", testUserId);
      
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
    });

    it("should handle WebM video files", async () => {
      const buffer = Buffer.from("fake video data");
      const result = await uploadMediaFile(buffer, "test.webm", "video/webm", testUserId);
      
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
    });
  });
});
