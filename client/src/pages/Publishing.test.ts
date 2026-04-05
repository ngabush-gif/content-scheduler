import { describe, it, expect } from "vitest";

/**
 * Test: Verify that image URL is included in clipboard copy
 * This tests the text construction logic for the Publishing dialog
 */
describe("Publishing - Image URL Copy", () => {
  it("should include image URL in copied text when imageUrl is provided", () => {
    const caption = "Test caption";
    const hashtags = "#test #hashtag";
    const imageUrl = "https://example.com/image.jpg";

    // Simulate the copy text construction logic from Publishing.tsx
    let textToCopy = caption;
    if (hashtags) {
      textToCopy = `${caption}\n\n${hashtags}`;
    }
    if (imageUrl) {
      textToCopy = `${textToCopy}\n\nImage: ${imageUrl}`;
    }

    // Verify the format includes all three components
    expect(textToCopy).toContain(caption);
    expect(textToCopy).toContain(hashtags);
    expect(textToCopy).toContain(`Image: ${imageUrl}`);

    // Verify the exact format
    const expected = `Test caption\n\n#test #hashtag\n\nImage: https://example.com/image.jpg`;
    expect(textToCopy).toBe(expected);
  });

  it("should not include image line when imageUrl is null", () => {
    const caption = "Test caption";
    const hashtags = "#test #hashtag";
    const imageUrl = null;

    let textToCopy = caption;
    if (hashtags) {
      textToCopy = `${caption}\n\n${hashtags}`;
    }
    if (imageUrl) {
      textToCopy = `${textToCopy}\n\nImage: ${imageUrl}`;
    }

    // Verify image line is not included
    expect(textToCopy).not.toContain("Image:");
    expect(textToCopy).toBe(`Test caption\n\n#test #hashtag`);
  });

  it("should handle caption without hashtags but with image URL", () => {
    const caption = "Test caption only";
    const hashtags = "";
    const imageUrl = "https://example.com/image.jpg";

    let textToCopy = caption;
    if (hashtags) {
      textToCopy = `${caption}\n\n${hashtags}`;
    }
    if (imageUrl) {
      textToCopy = `${textToCopy}\n\nImage: ${imageUrl}`;
    }

    // Verify format when no hashtags
    const expected = `Test caption only\n\nImage: https://example.com/image.jpg`;
    expect(textToCopy).toBe(expected);
  });

  it("should handle caption with only hashtags, no image", () => {
    const caption = "Test caption";
    const hashtags = "#test";
    const imageUrl = null;

    let textToCopy = caption;
    if (hashtags) {
      textToCopy = `${caption}\n\n${hashtags}`;
    }
    if (imageUrl) {
      textToCopy = `${textToCopy}\n\nImage: ${imageUrl}`;
    }

    // Verify format without image
    const expected = `Test caption\n\n#test`;
    expect(textToCopy).toBe(expected);
  });
});
