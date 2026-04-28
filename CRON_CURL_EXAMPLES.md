# Cron Endpoint - Curl Examples

## Quick Reference

### Test the Endpoint

```bash
# Replace YOUR_CRON_SECRET_TOKEN with the actual token
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Expected Response (No Posts Ready)

```json
{
  "success": true,
  "postsPublished": 0,
  "durationMs": 145,
  "timestamp": "2026-04-28T09:54:42.906Z",
  "source": "external-cron"
}
```

---

## Common Curl Commands

### 1. Test with Verbose Output

```bash
curl -v -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

This shows:
- Request headers
- Response headers
- Response body
- HTTP status code

### 2. Test with Pretty JSON Output

```bash
curl -s -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

Requires `jq` to be installed. Shows formatted JSON output.

### 3. Test with Timeout

```bash
curl --max-time 10 -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Fails if response takes longer than 10 seconds.

### 4. Test with Custom User-Agent

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: ContentHub-Cron/1.0" \
  -d '{}'
```

### 5. Test and Save Response to File

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > response.json
```

### 6. Test with Request Timing

```bash
curl -w "\nTime: %{time_total}s\nHTTP Code: %{http_code}\n" \
  -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Shows:
- Total request time
- HTTP status code

---

## Testing Authentication

### 1. Test Without Token (Should Fail)

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (401):
```json
{
  "error": "Unauthorized: Invalid or missing Bearer token"
}
```

### 2. Test with Invalid Token (Should Fail)

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (401):
```json
{
  "error": "Unauthorized: Invalid or missing Bearer token"
}
```

### 3. Test with Valid Token (Should Succeed)

```bash
curl -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (200):
```json
{
  "success": true,
  "postsPublished": 0,
  "durationMs": 145,
  "timestamp": "2026-04-28T09:54:42.906Z",
  "source": "external-cron"
}
```

---

## Bash Script for Monitoring

### Monitor Endpoint Every 5 Minutes

```bash
#!/bin/bash

ENDPOINT="https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts"
TOKEN="YOUR_CRON_SECRET_TOKEN"
LOG_FILE="cron_monitor.log"

while true; do
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  RESPONSE=$(curl -s -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
  
  echo "[$TIMESTAMP] $RESPONSE" >> "$LOG_FILE"
  
  # Extract posts published count
  POSTS_PUBLISHED=$(echo "$RESPONSE" | jq '.postsPublished // 0')
  if [ "$POSTS_PUBLISHED" -gt 0 ]; then
    echo "[$TIMESTAMP] ✅ Published $POSTS_PUBLISHED post(s)"
  else
    echo "[$TIMESTAMP] ℹ️ No posts published"
  fi
  
  sleep 300  # Wait 5 minutes
done
```

Save as `monitor_cron.sh` and run:
```bash
chmod +x monitor_cron.sh
./monitor_cron.sh
```

---

## Python Script for Testing

```python
#!/usr/bin/env python3

import requests
import json
from datetime import datetime

ENDPOINT = "https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts"
TOKEN = "YOUR_CRON_SECRET_TOKEN"

def test_endpoint():
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(ENDPOINT, headers=headers, json={}, timeout=10)
        
        print(f"[{datetime.now()}] Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            posts_published = data.get('postsPublished', 0)
            duration = data.get('durationMs', 0)
            print(f"✅ Success: {posts_published} posts published in {duration}ms")
        else:
            print(f"❌ Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_endpoint()
```

Save as `test_cron.py` and run:
```bash
python3 test_cron.py
```

---

## Node.js Script for Testing

```javascript
#!/usr/bin/env node

const https = require('https');

const ENDPOINT = "https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts";
const TOKEN = "YOUR_CRON_SECRET_TOKEN";

function testEndpoint() {
  const url = new URL(ENDPOINT);
  
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`[${new Date().toISOString()}] Status: ${res.statusCode}`);
      
      try {
        const json = JSON.parse(data);
        console.log('Response:', JSON.stringify(json, null, 2));
        
        if (res.statusCode === 200) {
          const postsPublished = json.postsPublished || 0;
          const duration = json.durationMs || 0;
          console.log(`✅ Success: ${postsPublished} posts published in ${duration}ms`);
        } else {
          console.log(`❌ Error: ${res.statusCode}`);
        }
      } catch (e) {
        console.log('Response:', data);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error(`❌ Exception: ${e.message}`);
  });
  
  req.write('{}');
  req.end();
}

testEndpoint();
```

Save as `test_cron.js` and run:
```bash
node test_cron.js
```

---

## Cron Service Configuration Examples

### cron-job.org Configuration

**URL:** `https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts`

**Method:** `POST`

**Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET_TOKEN
Content-Type: application/json
```

**Body:** `{}`

**Execution:** Every 5 minutes

---

### EasyCron Configuration

**URL:** `https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts`

**Cron Expression:** `*/5 * * * *`

**Method:** `POST`

**Custom Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET_TOKEN
Content-Type: application/json
```

**Body:** `{}`

---

### AWS Lambda Configuration

```javascript
const https = require('https');

exports.handler = async (event) => {
  const token = process.env.CRON_SECRET_TOKEN;
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'contenthub-zayg9ao8.manus.space',
      path: '/api/scheduled/publish-due-posts',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(JSON.parse(data));
      });
    });
    
    req.on('error', reject);
    req.write('{}');
    req.end();
  });
};
```

---

## Troubleshooting with Curl

### Check HTTP Status Code

```bash
curl -w "%{http_code}\n" -o /dev/null -s \
  -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `200`

### Check Response Headers

```bash
curl -i -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Look for:
- `HTTP/1.1 200 OK`
- `Content-Type: application/json`

### Check DNS Resolution

```bash
nslookup contenthub-zayg9ao8.manus.space
```

Should return an IP address.

### Check SSL Certificate

```bash
curl --cacert /etc/ssl/certs/ca-certificates.crt \
  -X POST https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Should work without SSL errors.

---

## Performance Testing

### Load Test with Apache Bench

```bash
ab -n 100 -c 10 -p payload.json \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts
```

Where `payload.json` contains: `{}`

### Load Test with wrk

```bash
wrk -t4 -c100 -d30s \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -s script.lua \
  https://contenthub-zayg9ao8.manus.space/api/scheduled/publish-due-posts
```

Where `script.lua` contains:
```lua
wrk.method = "POST"
wrk.body = "{}"
```

---

## Notes

- Replace `YOUR_CRON_SECRET_TOKEN` with the actual token from environment variables
- All requests must use HTTPS (not HTTP)
- The endpoint accepts empty JSON body: `{}`
- Response time should be < 1 second for normal operation
- If response time > 5 seconds, check database connection
