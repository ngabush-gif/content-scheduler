# Railway Deployment Guide - ContentHub Facebook Scheduler

**Goal:** Deploy ContentHub to Railway with true 24/7 automatic Facebook post scheduling.

---

## Why Railway?

- ✅ True background workers (not session-dependent)
- ✅ Continuous process execution (24/7)
- ✅ No cold starts or idle shutdowns
- ✅ Simple deployment from GitHub
- ✅ Built-in environment variable management
- ✅ Free tier available for testing

---

## Prerequisites

1. **GitHub Account** - To connect your repository
2. **Railway Account** - Create at https://railway.app
3. **Facebook App Credentials** - Already configured in your app

---

## Step 1: Prepare Your GitHub Repository

### 1.1 Push Code to GitHub

```bash
cd /home/ubuntu/content-creator-hub
git init
git add .
git commit -m "Initial commit: ContentHub with Railway deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/content-creator-hub.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### 1.2 Verify These Files Exist

- ✅ `Procfile` - Tells Railway how to start the app
- ✅ `package.json` - Dependencies and scripts
- ✅ `.env.example` - Environment variable template (if available)

---

## Step 2: Create Railway Project

### 2.1 Sign Up / Log In

1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign in with GitHub

### 2.2 Connect GitHub Repository

1. Click "Deploy from GitHub"
2. Select "Install Railway GitHub App"
3. Authorize Railway to access your repositories
4. Select your `content-creator-hub` repository
5. Click "Deploy"

Railway will automatically:
- Detect your Procfile
- Install dependencies
- Build your app
- Start the web process

---

## Step 3: Configure Environment Variables

### 3.1 Add Variables in Railway Dashboard

1. Go to your Railway project dashboard
2. Click on the "Variables" tab
3. Add these environment variables:

| Variable | Value | Source |
|----------|-------|--------|
| `DATABASE_URL` | Your MySQL connection string | From Manus or your database provider |
| `JWT_SECRET` | Your JWT secret | Keep it secure |
| `FACEBOOK_APP_ID` | Your Facebook App ID | Facebook Developer Console |
| `FACEBOOK_APP_SECRET` | Your Facebook App Secret | Facebook Developer Console |
| `FACEBOOK_REDIRECT_URI` | `https://your-railway-domain.railway.app/api/oauth/callback` | Railway domain (see Step 4) |
| `VITE_APP_ID` | Your app ID | Same as FACEBOOK_APP_ID |
| `VITE_APP_TITLE` | ContentHub | Your app name |
| `VITE_APP_LOGO` | Your logo URL | S3 or CDN URL |
| `NODE_ENV` | `production` | Production environment |
| `PORT` | `3000` | Default port |

### 3.2 Get Your Railway Domain

1. In Railway dashboard, go to "Settings" tab
2. Look for "Domain" section
3. Your domain will be: `https://your-app-name.railway.app`
4. Update `FACEBOOK_REDIRECT_URI` with this domain

---

## Step 4: Update Facebook OAuth Redirect URI

### 4.1 In Facebook Developer Console

1. Go to https://developers.facebook.com
2. Select your app
3. Go to "Settings" → "Basic"
4. Update "App Domains" to: `your-railway-domain.railway.app`
5. Go to "Products" → "Facebook Login" → "Settings"
6. Update "Valid OAuth Redirect URIs" to:
   ```
   https://your-railway-domain.railway.app/api/oauth/callback
   ```
7. Save changes

---

## Step 5: Verify Deployment

### 5.1 Check Deployment Status

1. In Railway dashboard, go to "Deployments" tab
2. Wait for status to show "Success" (green checkmark)
3. Click on the deployment to view logs

### 5.2 Test the App

1. Go to your Railway domain: `https://your-app-name.railway.app`
2. You should see your ContentHub homepage
3. Try logging in with Facebook

### 5.3 Verify Scheduler is Running

1. In Railway dashboard, click "Logs" tab
2. Look for messages like:
   ```
   [ResilientScheduler] ⏱️ Cycle #1 started at 2026-04-28T20:00:00.000Z
   [ResilientScheduler] ✓ No posts ready to publish
   [ResilientScheduler] Cycle #1 completed in 234ms
   ```
3. These should appear every 60 seconds

---

## Step 6: Test Scheduled Posts

### 6.1 Schedule a Test Post

1. Log in to your deployed app
2. Create a new post
3. Schedule it for 5 minutes from now (Brisbane time)
4. Note the exact scheduled time

### 6.2 Monitor the Scheduler

1. Go to Railway dashboard → "Logs" tab
2. Watch for the scheduler cycle that matches your post time
3. You should see:
   ```
   [ResilientScheduler] Found 1 scheduled posts
   [ResilientScheduler] 🔄 Publishing post 123 (attempt 1)
   [ResilientScheduler] ✅ Published post 123
   ```

### 6.3 Verify on Facebook

1. Check your Facebook page
2. Post should appear at the exact scheduled time
3. No need to open the app - it publishes automatically

---

## Step 7: Enable Auto-Deploy

### 7.1 Automatic Deployments on Push

1. In Railway dashboard, go to "Settings" tab
2. Find "GitHub Integration" section
3. Toggle "Auto Deploy" to ON
4. Now every push to main branch auto-deploys

---

## Monitoring & Troubleshooting

### View Logs

```bash
# In Railway dashboard:
1. Click "Logs" tab
2. Filter by "ResilientScheduler" to see scheduler activity
3. Look for errors in red text
```

### Common Issues

**Issue: Posts not publishing**
- Check logs for scheduler errors
- Verify Facebook credentials in environment variables
- Check if post is actually scheduled (status = "scheduled")

**Issue: Deployment failed**
- Check build logs for errors
- Verify all environment variables are set
- Ensure database connection string is correct

**Issue: Scheduler not running**
- Check if web process is running (should show "Running" in dashboard)
- Look for SIGTERM messages in logs (app might be restarting)
- Verify Procfile exists and is correct

### Get Help

- Railway Docs: https://docs.railway.app
- Check deployment logs for specific error messages
- Verify all environment variables are set correctly

---

## Database Considerations

### Using Manus Database

If you're using Manus's hosted database:
1. Get your `DATABASE_URL` from Manus dashboard
2. Add it to Railway environment variables
3. Ensure your app can connect to it from Railway's servers

### Using External Database

If you want to use a separate database:
1. Create a database (MySQL, PostgreSQL, etc.)
2. Get the connection string
3. Add to Railway environment variables

---

## Scaling & Performance

### Current Setup

- **Process Type:** Single web process
- **Scheduler:** Runs every 60 seconds
- **Posts per cycle:** 1 (processes one post at a time)
- **Concurrency:** Sequential (safe for Facebook API limits)

### If You Need to Scale

1. **Increase cycle frequency:** Change `60 * 1000` to `30 * 1000` in `resilientScheduler.ts` (every 30 seconds)
2. **Process multiple posts:** Change `.slice(0, 1)` to `.slice(0, 5)` to process 5 posts per cycle
3. **Add worker processes:** Deploy separate worker dynos (advanced)

---

## Success Criteria

✅ **Deployment is successful when:**

1. Railway shows "Running" status (green)
2. App is accessible at Railway domain
3. Logs show scheduler running every 60 seconds
4. Test post publishes at exact scheduled time
5. No user interaction needed (app can be closed)
6. Posts publish 24/7 continuously

---

## Next Steps After Deployment

1. **Schedule multiple test posts** across different times
2. **Monitor for 24-48 hours** to verify reliability
3. **Check Facebook page** to confirm posts appear on time
4. **Review logs** for any errors or warnings
5. **Enable auto-deploy** for future updates

---

## Rollback / Downgrade

If something goes wrong:

1. Go to Railway dashboard → "Deployments" tab
2. Find the previous successful deployment
3. Click "Redeploy" to go back to that version
4. Your app will revert immediately

---

## Cost Estimate

**Railway Free Tier:**
- $5 free credit per month
- Includes: 500 hours of compute, 100GB bandwidth
- **Your app:** ~$0-2/month (well within free tier)

**If you exceed free tier:**
- Pay-as-you-go: ~$0.000463/hour per GB RAM
- **Your app:** ~$3-5/month for continuous running

---

## Support & Feedback

- Railway Status: https://status.railway.app
- Community Discord: https://discord.gg/railway
- Documentation: https://docs.railway.app
