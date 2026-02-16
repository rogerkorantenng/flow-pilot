from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    from app.seed_data import seed_templates
    await seed_templates()

    from app.services.scheduler_service import load_scheduled_workflows, scheduler
    scheduler.start()
    await load_scheduled_workflows()

    yield

    scheduler.shutdown()


app = FastAPI(title="FlowPilot", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.chat import router as chat_router
from app.api.insights import router as insights_router
from app.api.results import router as results_router
from app.api.runs import router as runs_router
from app.api.screen import router as screen_router
from app.api.templates import router as templates_router
from app.api.users import router as users_router
from app.api.workflows import router as workflows_router

app.include_router(users_router)
app.include_router(workflows_router)
app.include_router(runs_router)
app.include_router(templates_router)
app.include_router(results_router)
app.include_router(chat_router)
app.include_router(insights_router)
app.include_router(screen_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "flowpilot"}
