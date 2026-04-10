import { describe, it, expect } from "vitest";

describe("Facebook Credentials", () => {
  it("should have Facebook App ID configured", () => {
    const appId = process.env.FACEBOOK_APP_ID;
    expect(appId).toBeDefined();
    expect(appId).toMatch(/^\d+$/); // Should be numeric
    expect(appId?.length).toBeGreaterThan(10);
  });

  it("should have Facebook App Secret configured", () => {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    expect(appSecret).toBeDefined();
    expect(appSecret?.length).toBeGreaterThan(20);
  });

  it("should have Facebook Redirect URI configured", () => {
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    expect(redirectUri).toBeDefined();
    expect(redirectUri).toMatch(/^https:\/\//);
    expect(redirectUri).toMatch(/[Cc]allback/); // Case-insensitive check
  });

  it("should be able to construct OAuth URL", () => {
    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    
    const scopes = ["pages_manage_posts", "pages_read_engagement", "pages_show_list"];
    const oauthUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    oauthUrl.searchParams.append("client_id", appId!);
    oauthUrl.searchParams.append("redirect_uri", redirectUri!);
    oauthUrl.searchParams.append("scope", scopes.join(","));
    oauthUrl.searchParams.append("response_type", "code");
    
    const url = oauthUrl.toString();
    expect(url).toContain(appId);
    expect(url).toContain("pages_manage_posts");
    expect(url).toContain("pages_show_list");
  });
});
