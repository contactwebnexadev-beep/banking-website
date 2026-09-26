<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f9e494df-9bc9-4253-8861-31f5087a4bf5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## MongoDB Atlas and Vercel

The Express API stores users, accounts, transactions, verification codes, and audit logs in MongoDB Atlas through Mongoose. Set `MONGO_URI` in `.env.local` for local development and in the Vercel project environment variables for deployment. Use an Atlas database user with access limited to this application's database.

To provision the first administrator in a new database, set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment before the first API request. The password is hashed before it is stored. These values are only used to create the administrator if that email does not already exist.

Vercel serves the Vite build from `dist` and sends `/api/*` requests to the serverless Express function in `api/index.ts`. The MongoDB connection is cached across warm function invocations; each request waits for the connection before running an API route.

The previous local `bank.sqlite` file is no longer read or modified, and its records are not imported automatically. Export and migrate any data you need before relying on the Atlas database.
