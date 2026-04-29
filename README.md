# Content Creator Hub - Facebook Scheduling

A production-ready Facebook post scheduling application with automatic publishing on Railway.

## Features

- **24/7 Automatic Scheduling** - Posts publish at exact scheduled times without user interaction
- **Timezone Support** - Schedule posts in Australia/Brisbane timezone
- **Reliable Scheduler** - Runs every 60 seconds with automatic retry logic
- **Facebook Integration** - Direct publishing to Facebook pages
- **Database Backed** - MySQL/TiDB for persistent storage

## Deployment

This app is deployed on Railway with:
- Automatic scheduler running in the background
- Database connection for post storage
- Facebook OAuth integration
- 24/7 uptime without requiring user session

## Scheduler Status

The resilient scheduler checks for due posts every 60 seconds and publishes them automatically to Facebook.

Posts scheduled in Australia/Brisbane timezone are converted to UTC and stored in the database, then published at the exact scheduled time.

## Technology Stack

- React 19 + Tailwind CSS 4
- Express 4 + tRPC 11
- Drizzle ORM with MySQL/TiDB
- Node.js with TypeScript
- Railway for deployment

## Getting Started

See `RAILWAY_QUICK_START.md` for deployment instructions.
