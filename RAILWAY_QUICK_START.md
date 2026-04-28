# Railway Deployment - Quick Start (5 Minutes)

## What You'll Do

1. Push code to GitHub
2. Connect GitHub to Railway
3. Add environment variables
4. Deploy
5. Verify scheduler is running

---

## Step 1: Push to GitHub (2 minutes)

```bash
cd /home/ubuntu/content-creator-hub

# Initialize git if not already done
git init
git add .
git commit -m "Ready for Railway deployment"
git branch -M main

# Add your GitHub repo
git remote add origin https://github.com/YOUR_USERNAME/content-creator-hub.git
git push -u origin main
```

---

## Step 2: Create Railway Project (1 minute)

1. Go to https://railway.app
2. Click "Start a New Project"
3. Click "Deploy from GitHub"
4. Authorize Railway
5. Select your `content-creator-hub` repo
6. Click "Deploy"

Railway will start building automatically.

---

## Step 3: Add Environment Variables (1 minute)

While Railway is building, go to your project dashboard:

1. Click "Variables" tab
2. Add these required variables:

```
DATABASE_URL = your_mysql_connection_string
JWT_SECRET = your_jwt_secret
FACEBOOK_APP_ID = your_facebook_app_id
FACEBOOK_APP_SECRET = your_facebook_app_secret
FACEBOOK_REDIRECT_URI = https://YOUR_RAILWAY_DOMAIN.railway.app/api/oauth/callback
NODE_ENV = production
PORT = 3000
```

**Get your Railway domain:**
- Go to "Settings" tab
- Look for "Domain" section
- Copy the domain (e.g., `content-hub-xyz.railway.app`)
- Use it in `FACEBOOK_REDIRECT_URI`

---

## Step 4: Update Facebook OAuth (1 minute)

1. Go to https://developers.facebook.com
2. Select your app
3. Go to "Settings" → "Basic"
4. Update "App Domains" to: `YOUR_RAILWAY_DOMAIN.railway.app`
5. Go to "Facebook Login" → "Settings"
6. Update "Valid OAuth Redirect URIs" to:
   ```
   https://YOUR_RAILWAY_DOMAIN.railway.app/api/oauth/callback
   ```
7. Save

---

## Step 5: Verify Deployment (1 minute)

1. Go back to Railway dashboard
2. Wait for deployment to finish (green "Success" status)
3. Click "Logs" tab
4. Look for messages like:
   ```
   [ResilientScheduler] ⏱️ Cycle #1 started
   [ResilientScheduler] ✓ No posts ready to publish
   ```
5. These should repeat every 60 seconds

---

## ✅ You're Done!

Your app is now running 24/7 on Railway with automatic scheduling.

### Test It

1. Go to `https://YOUR_RAILWAY_DOMAIN.railway.app`
2. Log in with Facebook
3. Schedule a post for 5 minutes from now
4. Watch the logs - it will publish automatically
5. Check Facebook - post appears at exact time

### No More Stuck "Publishing" Status

Posts now publish automatically without you opening the app.

---

## Troubleshooting

**Deployment failed?**
- Check "Deployments" tab for error messages
- Verify all environment variables are set
- Check database connection string

**Scheduler not running?**
- Check "Logs" tab for errors
- Verify web process shows "Running" status
- Look for SIGTERM messages (app restarting)

**Posts not publishing?**
- Check logs for scheduler cycles
- Verify Facebook credentials
- Ensure post status is "scheduled"

---

## Full Documentation

For detailed setup and troubleshooting, see: `RAILWAY_DEPLOYMENT_GUIDE.md`
