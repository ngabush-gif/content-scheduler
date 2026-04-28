import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import { registerScheduledPublishEndpoint } from './scheduledPublishEndpoint';

describe('Scheduled Publish Endpoint', () => {
  let app: any;
  let server: any;
  let port = 3001;

  beforeAll(async () => {
    // Set the CRON_SECRET_TOKEN for testing
    process.env.CRON_SECRET_TOKEN = process.env.CRON_SECRET_TOKEN || 'test-token-123';
    
    app = express();
    app.use(express.json());
    registerScheduledPublishEndpoint(app);
    
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        console.log(`Test server running on port ${port}`);
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
  });

  it('should reject requests without Bearer token', async () => {
    const response = await fetch(`http://localhost:${port}/api/scheduled/publish-due-posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Unauthorized');
  });

  it('should reject requests with invalid Bearer token', async () => {
    const response = await fetch(`http://localhost:${port}/api/scheduled/publish-due-posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
      },
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Unauthorized');
  });

  it('should accept requests with valid Bearer token', async () => {
    const token = process.env.CRON_SECRET_TOKEN;
    const response = await fetch(`http://localhost:${port}/api/scheduled/publish-due-posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.source).toBe('external-cron');
    expect(data.timestamp).toBeDefined();
  });

  it('should return JSON response with required fields', async () => {
    const token = process.env.CRON_SECRET_TOKEN;
    const response = await fetch(`http://localhost:${port}/api/scheduled/publish-due-posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Verify JSON response structure
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('postsPublished');
    expect(data).toHaveProperty('durationMs');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('source');
    expect(data.source).toBe('external-cron');
  });
});
