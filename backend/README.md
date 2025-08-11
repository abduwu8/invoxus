# Render Deployment (Single Web Service)

This backend can serve the built React frontend so you can deploy both as a single Render Web Service.

## Expected environment variables

- PORT: Provided by Render (no need to set)
- MONGODB_URI: Connection string to MongoDB
- SESSION_SECRET: Any strong secret string
- GOOGLE_CLIENT_ID: Google OAuth Web client ID
- GOOGLE_CLIENT_SECRET: Google OAuth client secret
- GROQ_API_KEY: Optional for AI features
- INNGEST_APP_ID, INNGEST_APP_NAME, INNGEST_SIGNING_KEY: Optional if using Inngest
- FRONTEND_ORIGIN: Optional local dev origin; in production same-origin is used
- CORS_ALLOW_ALL: Set to `1` only for debugging; not recommended

## Build and start commands on Render

Use a root build script to install frontend, build it, then install backend deps:

```
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix backend ci
```

Start command:

```
npm --prefix backend start
```

The server serves static files from `frontend/dist` in production and falls back to `index.html` for SPA routes.

## Email Backend

Express server with MongoDB (Mongoose).

### Setup
- Install deps: `npm install`
- Create `.env` with:

```
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/email_app
```

### Run
- Dev: `npm run dev`
- Prod: `npm start`

Health check: GET `http://localhost:4000/health`


