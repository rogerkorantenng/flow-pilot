import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_id
from app.db.database import get_db
from app.models.workflow import Workflow

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


class WorkflowCreate(BaseModel):
    name: str
    description: str | None = None
    steps_json: str | None = None
    variables_json: str | None = None
    trigger_type: str = "manual"
    schedule_cron: str | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    steps_json: str | None = None
    variables_json: str | None = None
    trigger_type: str | None = None
    schedule_cron: str | None = None
    status: str | None = None


class PlanRequest(BaseModel):
    description: str


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: str | None
    steps_json: str | None
    variables_json: str | None = None
    trigger_type: str
    schedule_cron: str | None
    status: str
    created_at: str
    updated_at: str
    last_run: dict | None = None
    run_count: int = 0

    class Config:
        from_attributes = True


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows(user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow).where(Workflow.user_id == user_id).order_by(Workflow.created_at.desc())
    )
    workflows = result.scalars().all()
    responses = []
    for w in workflows:
        last_run = None
        run_count = len(w.runs) if w.runs else 0
        if w.runs:
            sorted_runs = sorted(w.runs, key=lambda r: r.created_at, reverse=True)
            lr = sorted_runs[0]
            last_run = {"id": lr.id, "status": lr.status, "created_at": lr.created_at.isoformat()}
        responses.append(
            WorkflowResponse(
                id=w.id,
                name=w.name,
                description=w.description,
                steps_json=w.steps_json,
                variables_json=w.variables_json,
                trigger_type=w.trigger_type,
                schedule_cron=w.schedule_cron,
                status=w.status,
                created_at=w.created_at.isoformat(),
                updated_at=w.updated_at.isoformat(),
                last_run=last_run,
                run_count=run_count,
            )
        )
    return responses


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    last_run = None
    run_count = len(workflow.runs) if workflow.runs else 0
    if workflow.runs:
        sorted_runs = sorted(workflow.runs, key=lambda r: r.created_at, reverse=True)
        lr = sorted_runs[0]
        last_run = {"id": lr.id, "status": lr.status, "created_at": lr.created_at.isoformat()}

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        steps_json=workflow.steps_json,
        variables_json=workflow.variables_json,
        trigger_type=workflow.trigger_type,
        schedule_cron=workflow.schedule_cron,
        status=workflow.status,
        created_at=workflow.created_at.isoformat(),
        updated_at=workflow.updated_at.isoformat(),
        last_run=last_run,
        run_count=run_count,
    )


@router.post("", response_model=WorkflowResponse)
async def create_workflow(req: WorkflowCreate, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    workflow = Workflow(
        user_id=user_id,
        name=req.name,
        description=req.description,
        steps_json=req.steps_json,
        variables_json=req.variables_json,
        trigger_type=req.trigger_type,
        schedule_cron=req.schedule_cron,
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        steps_json=workflow.steps_json,
        variables_json=workflow.variables_json,
        trigger_type=workflow.trigger_type,
        schedule_cron=workflow.schedule_cron,
        status=workflow.status,
        created_at=workflow.created_at.isoformat(),
        updated_at=workflow.updated_at.isoformat(),
    )


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    req: WorkflowUpdate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(workflow, field, value)

    await db.commit()
    await db.refresh(workflow)

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        steps_json=workflow.steps_json,
        variables_json=workflow.variables_json,
        trigger_type=workflow.trigger_type,
        schedule_cron=workflow.schedule_cron,
        status=workflow.status,
        created_at=workflow.created_at.isoformat(),
        updated_at=workflow.updated_at.isoformat(),
    )


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    await db.delete(workflow)
    await db.commit()
    return {"detail": "Workflow deleted"}


@router.post("/plan")
async def plan_workflow(req: PlanRequest):
    from app.services.planner_service import PlannerService

    planner = PlannerService()
    steps = await planner.plan(req.description)
    return {"steps": steps}


@router.post("/{workflow_id}/run")
async def trigger_run(workflow_id: str, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not workflow.steps_json:
        raise HTTPException(status_code=400, detail="Workflow has no steps defined")

    from app.services.executor_service import ExecutorService

    executor = ExecutorService()
    run = await executor.start_run(workflow, db)
    return {"run_id": run.id, "status": run.status}


@router.post("/webhook/{workflow_id}")
async def webhook_trigger(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """Trigger a workflow run via webhook. No auth required."""
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not workflow.steps_json:
        raise HTTPException(status_code=400, detail="Workflow has no steps")

    from app.services.executor_service import ExecutorService
    executor = ExecutorService()
    run = await executor.start_run(workflow, db)
    return {"run_id": run.id, "status": run.status, "trigger": "webhook"}


@router.get("/ai/status")
async def ai_status():
    """Check the Nova AI connection status."""
    from app.config import get_settings
    settings = get_settings()

    status = {
        "text_model": settings.NOVA_TEXT_MODEL,
        "image_model": settings.NOVA_IMAGE_MODEL,
        "region": settings.AWS_REGION,
        "connected": False,
        "throttled": False,
        "message": "Not connected",
    }

    try:
        from app.services.nova_service import NovaService
        nova = NovaService()
        nova.client.meta.region_name  # Verify client
        status["connected"] = True

        if nova._is_throttled():
            status["throttled"] = True
            status["message"] = "Connected but rate-limited (will auto-recover)"
        else:
            status["message"] = "Connected and ready"
    except Exception as e:
        status["message"] = f"Connection failed: {str(e)}"

    return status
