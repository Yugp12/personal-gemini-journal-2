# Personal Gemini Journal

A production-grade, privacy-first AI journaling web application built with Google Gemini 3.7 Flash, React 18, TypeScript, Tailwind CSS, Express, Firebase Authentication, and Google Cloud Firestore.

## Key Features

- **Write → Save → Reflect Workflow**: Intuitive daily journaling with mood tracking (9 mood categories) and custom tagging.
- **AI Journal Reflection**: Server-side Gemini 3.7 Flash analysis extracting emotional tone, cognitive insights, key themes, reflection prompts, and tag suggestions.
- **Empathetic AI Companion**: Multi-turn dialogue with memory-grounded context and strict token/character bounding.
- **Explicit AI Memory Management**: User-controlled memory approval and deletion where AI memories are persisted only with direct user confirmation.
- **Protected Privacy Vault**: Isolated storage requiring elevated Google re-authentication (`reauthenticateWithPopup`), default-locked state, zero local caching, and 100% exclusion from all AI model context.
- **Real-Time Security Command Center**: Live 12-rule automated diagnostic suite, live security score calculation, interactive policy demo, and threat matrix.
- **Enterprise Security Architecture**:
  - Path-scoped Firestore UID isolation (`/users/{uid}/*`) with default-deny security rules.
  - Zero client-side API keys or secrets.
  - Google Cloud Secret Manager runtime retrieval (`@google-cloud/secret-manager`) with in-memory TTL caching.
  - Prompt injection defense with `<untrusted_journal_entry>` XML tagging and instruction delimitation.
  - Strict input size limits and sanitization across all Express API endpoints.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Motion
- **Backend Server**: Node.js, Express, tsx, esbuild
- **AI & Cloud**: Google GenAI SDK (`@google/genai`), Google Cloud Secret Manager (`@google-cloud/secret-manager`), Gemini 3.7 Flash
- **Database & Auth**: Firebase Auth (Google Sign-In), Cloud Firestore

## Getting Started

### Prerequisites
- Node.js 18+
- npm or bun
- Firebase project with Authentication (Google Provider) & Firestore
- Google Gemini API Key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Yugp12/personal-gemini-journal.git
   cd personal-gemini-journal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Set your `GEMINI_API_KEY` in `.env`.

4. Start development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   npm start
   ```

## Google Cloud Run Deployment

The repository includes a production-ready, multi-stage `Dockerfile` located at the root of the repository (`/Dockerfile`), specifically configured for containerized deployments on Google Cloud Run.

### Deployment Details & Specifications

- **Dockerfile Location**: `/Dockerfile` (root directory)
- **Production Build Command**: `npm run build` (`vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`)
- **Production Start Command**: `npm start` (`node dist/server.cjs`)
- **PORT Requirement**: The application listens on `0.0.0.0` and respects `process.env.PORT` provided dynamically by Cloud Run (with `8080` fallback).
- **Health Check Endpoint**: `GET /health` (and `GET /api/health`) returns HTTP 200 with service health and uptime without exposing secrets or private data.
- **Environment Variables & Secrets**:
  - `PORT`: Provided dynamically by Google Cloud Run.
  - `NODE_ENV`: Set to `production`.
  - `GEMINI_API_KEY` / Secret Manager: Configure via Google Cloud Secret Manager (granting `roles/secretmanager.secretAccessor` to the Cloud Run Service Account) or via Cloud Run Secrets.
  - `GOOGLE_CLOUD_PROJECT`: Set to your GCP project ID.
- **Security Warning**: Never commit `.env` files, API keys, service account JSON files, or Firebase private keys to the repository.

### Deploy Command

```bash
gcloud run deploy personal-gemini-journal \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NODE_ENV=production
```

## License

MIT
