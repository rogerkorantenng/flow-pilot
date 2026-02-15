from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_id
from app.db.database import get_db
from app.models.workflow import Workflow
from app.models.workflow_step import WorkflowStep
from app.models.workflow_run import WorkflowRun

router = APIRouter(prefix="/api/results", tags=["results"])


class ExtractedResult(BaseModel):
    step_id: str
    run_id: str
    workflow_id: str
    workflow_name: str
    step_number: int
    action: str
    description: str | None
    target: str | None
    result_data: str
    run_status: str
    extracted_at: str | None

    class Config:
        from_attributes = True


@router.get("", response_model=list[ExtractedResult])
async def list_results(
    workflow_id: str | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(50, le=200),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all steps that have result_data, ordered by most recent."""
    query = (
        select(WorkflowStep)
        .join(WorkflowRun, WorkflowStep.run_id == WorkflowRun.id)
        .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
        .where(Workflow.user_id == user_id)
        .where(WorkflowStep.result_data.isnot(None))
        .where(WorkflowStep.result_data != "")
        .order_by(WorkflowStep.completed_at.desc())
        .limit(limit)
    )

    if workflow_id:
        query = query.where(WorkflowRun.workflow_id == workflow_id)

    if action:
        query = query.where(WorkflowStep.action == action)

    result = await db.execute(query)
    steps = result.scalars().all()

    return [
        ExtractedResult(
            step_id=s.id,
            run_id=s.run_id,
            workflow_id=s.run.workflow_id if s.run else "",
            workflow_name=s.run.workflow.name if s.run and s.run.workflow else "",
            step_number=s.step_number,
            action=s.action,
            description=s.description,
            target=s.target,
            result_data=s.result_data,
            run_status=s.run.status if s.run else "",
            extracted_at=s.completed_at.isoformat() if s.completed_at else None,
        )
        for s in steps
    ]
