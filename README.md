# FlowPilot - AI Workflow Engine

FlowPilot lets users describe business workflows in plain English, auto-decomposes them into executable steps using Amazon Nova AI, runs them via headless browser agents, and shows live execution on a real-time dashboard.

Built for the **Amazon Nova AI Hackathon** targeting the **Agentic AI + UI Automation** categories.

## Architecture

```
User (Dashboard) ──> FastAPI Backend ──> Amazon Bedrock
       │                   │                  │
       │ SSE Events        │ SQLAlchemy       │ Nova 2 Lite (Planning)
       │ (live updates)    │ (SQLite)         │ Nova Pro (Vision)
       │                   │                  │ Nova Act (Browser)
       ▼                   ▼                  ▼
  React + Vite      Workflow Engine     AI Services
  TanStack Query    APScheduler         Step Execution
  Recharts          SSE Streaming       Screenshot Analysis
  @dnd-kit          Error Recovery      Conditional Logic
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts, @dnd-kit |
| **Backend** | FastAPI, SQLAlchemy (async), APScheduler, SSE-Starlette |
| **AI** | Amazon Nova 2 Lite (planning), Nova Pro (vision), Nova Act SDK (browser automation) |
| **Database** | SQLite (dev), PostgreSQL (prod) |

## Features

- **Natural Language Workflow Creation** — Describe workflows in plain English, AI decomposes into steps
- **Visual Step Editor** — Drag-and-drop step reordering, action configuration
- **Live Run Viewer** — Real-time SSE-powered execution monitoring with step-by-step progress
- **Error Recovery** — Retry, skip, or abort failed steps during execution
- **Scheduling** — Cron-based scheduling for automated workflow runs
- **Templates** — 5 pre-built templates (Invoice Processing, Lead Research, Social Media Monitor, Competitor Price Check, Daily News Digest)
- **Dashboard** — Charts for run history, success rates, and status breakdowns

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- AWS credentials with Bedrock access (for AI features)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your AWS credentials
uvicorn app.main:app --reload
```

### Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173, create an account, and start building workflows.

### Docker

```bash
docker-compose up --build
```

Open http://localhost.

## Nova Model Usage

| Purpose | Model | Justification |
|---------|-------|---------------|
| NL workflow planning | Nova 2 Lite | Fast text reasoning, JSON generation |
| Screenshot analysis | Nova Pro | Multimodal image understanding |
| Browser automation | Nova Act SDK | Headless browser step execution |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Sign in |
| GET | /api/workflows | List workflows |
| POST | /api/workflows | Create workflow |
| POST | /api/workflows/plan | AI-plan workflow from NL description |
| POST | /api/workflows/:id/run | Trigger workflow run |
| GET | /api/runs/:id | Get run details with steps |
| GET | /api/runs/:id/live | SSE stream for live updates |
| POST | /api/runs/:id/steps/:stepId/retry | Retry failed step |
| POST | /api/runs/:id/steps/:stepId/skip | Skip failed step |
| GET | /api/templates | List templates |
| POST | /api/templates/use/:id | Create workflow from template |

## License

MIT
