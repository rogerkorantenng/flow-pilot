import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_user_id
from app.db.database import get_db
from app.models.workflow import Workflow
from app.models.workflow_run import WorkflowRun
from app.models.workflow_step import WorkflowStep
from app.services.executor_service import ExecutorService

router = APIRouter(prefix="/api/runs", tags=["runs"])


class StepResponse(BaseModel):
    id: str
    step_number: int
    action: str
    target: str | None
    value: str | None
    description: str | None
    condition: str | None
    status: str
    screenshot_b64: str | None = None
    result_data: str | None = None
    error_message: str | None = None
    started_at: str | None = None
    completed_at: str | None = None

    class Config:
        from_attributes = True


class RunResponse(BaseModel):
    id: str
    workflow_id: str
    workflow_name: str = ""
    status: str
    trigger: str
    total_steps: int
    completed_steps: int
    started_at: str | None = None
    completed_at: str | None = None
    created_at: str
    steps: list[StepResponse] = []

    class Config:
        from_attributes = True


@router.get("", response_model=list[RunResponse])
async def list_runs(
    workflow_id: str | None = None,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(WorkflowRun)
        .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
        .where(Workflow.user_id == user_id)
        .order_by(WorkflowRun.created_at.desc())
    )
    if workflow_id:
        query = query.where(WorkflowRun.workflow_id == workflow_id)

    result = await db.execute(query)
    runs = result.scalars().all()

    return [
        RunResponse(
            id=r.id,
            workflow_id=r.workflow_id,
            workflow_name=r.workflow.name if r.workflow else "",
            status=r.status,
            trigger=r.trigger,
            total_steps=r.total_steps,
            completed_steps=r.completed_steps,
            started_at=r.started_at.isoformat() if r.started_at else None,
            completed_at=r.completed_at.isoformat() if r.completed_at else None,
            created_at=r.created_at.isoformat(),
        )
        for r in runs
    ]


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: str, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkflowRun)
        .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
        .where(WorkflowRun.id == run_id, Workflow.user_id == user_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    steps = sorted(run.steps, key=lambda s: s.step_number) if run.steps else []

    return RunResponse(
        id=run.id,
        workflow_id=run.workflow_id,
        workflow_name=run.workflow.name if run.workflow else "",
        status=run.status,
        trigger=run.trigger,
        total_steps=run.total_steps,
        completed_steps=run.completed_steps,
        started_at=run.started_at.isoformat() if run.started_at else None,
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
        created_at=run.created_at.isoformat(),
        steps=[
            StepResponse(
                id=s.id,
                step_number=s.step_number,
                action=s.action,
                target=s.target,
                value=s.value,
                description=s.description,
                condition=s.condition,
                status=s.status,
                screenshot_b64=s.screenshot_b64,
                result_data=s.result_data,
                error_message=s.error_message,
                started_at=s.started_at.isoformat() if s.started_at else None,
                completed_at=s.completed_at.isoformat() if s.completed_at else None,
            )
            for s in steps
        ],
    )


@router.get("/{run_id}/live")
async def live_run(run_id: str):
    queue = ExecutorService.subscribe(run_id)

    async def event_generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield {"event": event.get("type", "message"), "data": json.dumps(event)}
                    if event.get("type") in ("run_completed", "run_failed"):
                        break
                except asyncio.TimeoutError:
                    yield {"event": "heartbeat", "data": json.dumps({"type": "heartbeat"})}
        finally:
            ExecutorService.unsubscribe(run_id, queue)

    return EventSourceResponse(event_generator())


@router.post("/{run_id}/steps/{step_id}/retry")
async def retry_step(run_id: str, step_id: str):
    ExecutorService.resolve_step(run_id, step_id, "retry")
    return {"detail": "Retry requested"}


@router.post("/{run_id}/steps/{step_id}/skip")
async def skip_step(run_id: str, step_id: str):
    ExecutorService.resolve_step(run_id, step_id, "skip")
    return {"detail": "Skip requested"}


@router.post("/{run_id}/abort")
async def abort_run(run_id: str):
    for key in list(ExecutorService._resolution_events.keys()):
        if key.startswith(run_id):
            ExecutorService.resolve_step(run_id, key.split(":")[1], "abort")
    return {"detail": "Abort requested"}


@router.get("/{run_id}/summary")
async def run_summary(run_id: str, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    """Generate an AI-powered natural language summary of a completed run."""
    result = await db.execute(
        select(WorkflowRun)
        .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
        .where(WorkflowRun.id == run_id, Workflow.user_id == user_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    steps = sorted(run.steps, key=lambda s: s.step_number) if run.steps else []
    workflow_name = run.workflow.name if run.workflow else "Workflow"

    # Build context from step results
    step_summaries = []
    for s in steps:
        status_emoji = {"completed": "passed", "failed": "FAILED", "skipped": "skipped"}.get(s.status, s.status)
        line = f"Step {s.step_number} ({s.action}) - {s.description}: {status_emoji}"
        if s.result_data:
            try:
                data = json.loads(s.result_data)
                # Trim to key info
                preview = json.dumps(data)[:300]
                line += f" | Data: {preview}"
            except Exception:
                pass
        if s.error_message:
            line += f" | Error: {s.error_message}"
        step_summaries.append(line)

    context = "\n".join(step_summaries)

    # Try Nova AI
    try:
        from app.services.nova_service import NovaService
        nova = NovaService()
        if not nova._is_throttled():
            prompt = f"""Summarize this workflow run in 2-3 concise sentences for a business user.

Workflow: {workflow_name}
Status: {run.status}
Steps completed: {run.completed_steps}/{run.total_steps}

Step details:
{context}

Write a natural, insightful summary focusing on key findings and results. Be specific with numbers and data points."""

            raw = await asyncio.to_thread(
                nova._invoke_text, prompt,
                "You are a concise business analyst. Summarize workflow results clearly.", 256
            )
            return {"summary": raw.strip(), "ai_generated": True}
    except Exception:
        pass

    # Fallback simulation
    duration = ""
    if run.started_at and run.completed_at:
        ms = (run.completed_at - run.started_at).total_seconds()
        duration = f" in {ms:.1f}s"

    extract_count = sum(1 for s in steps if s.action == "extract" and s.status == "completed")
    failed_count = sum(1 for s in steps if s.status == "failed")

    summary_parts = [f"**{workflow_name}** completed {run.completed_steps}/{run.total_steps} steps{duration}."]
    if extract_count > 0:
        summary_parts.append(f"Successfully extracted data from {extract_count} source{'s' if extract_count > 1 else ''}.")
    if failed_count > 0:
        summary_parts.append(f"{failed_count} step{'s' if failed_count > 1 else ''} failed during execution.")
    if run.status == "completed":
        summary_parts.append("All objectives were achieved successfully.")

    return {"summary": " ".join(summary_parts), "ai_generated": False}


class AIFixRequest(BaseModel):
    error_message: str
    step_action: str
    step_description: str | None = None
    step_target: str | None = None


@router.post("/{run_id}/steps/{step_id}/ai-fix")
async def ai_fix_step(run_id: str, step_id: str, req: AIFixRequest):
    """Use AI to analyze a step failure and suggest a fix."""
    # Try Nova AI
    try:
        from app.services.nova_service import NovaService
        nova = NovaService()
        if not nova._is_throttled():
            prompt = f"""A browser automation step failed. Analyze the error and suggest a fix.

Step: {req.step_action} - {req.step_description or 'N/A'}
Target: {req.step_target or 'N/A'}
Error: {req.error_message}

Provide:
1. Root cause (1 sentence)
2. Suggested fix (1-2 sentences)
3. Alternative approach if the fix doesn't work (1 sentence)

Be concise and practical."""

            raw = await asyncio.to_thread(
                nova._invoke_text, prompt,
                "You are a browser automation debugging expert. Be concise and actionable.", 256
            )
            return {"suggestion": raw.strip(), "ai_generated": True}
    except Exception:
        pass

    # Fallback simulation
    suggestions = {
        "ElementNotFound": "The target element may have changed. Try using a more specific CSS selector or waiting for the element to appear with a `wait` step before this one.",
        "TimeoutError": "The page took too long to load. Increase the step timeout in Settings, or add a `wait` step before this action to ensure content is ready.",
        "AccessDenied": "The page requires authentication. Add a login step before accessing this resource, or check if cookies/sessions have expired.",
        "ElementObscured": "A popup or overlay is blocking the element. Add a step to dismiss any modals or cookie banners before clicking.",
        "ElementDisabled": "The target button is disabled, likely because required form fields are empty. Ensure all prerequisite fields are filled before this step.",
        "StaleElement": "The page re-rendered while trying to interact with the element. Add a short `wait` step (1-2s) before retrying.",
        "ParseError": "The page structure has changed. Update the extraction target to match the current page layout.",
    }

    suggestion = "Try retrying the step. If the error persists, check the target selector and ensure the page is fully loaded."
    for key, val in suggestions.items():
        if key.lower() in req.error_message.lower():
            suggestion = val
            break

    return {"suggestion": suggestion, "ai_generated": False}
