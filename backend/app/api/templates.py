from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_id
from app.db.database import get_db
from app.models.workflow import Workflow
from app.models.workflow_template import WorkflowTemplate

router = APIRouter(prefix="/api/templates", tags=["templates"])


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str | None
    category: str
    steps_json: str
    icon: str
    popularity: int

    class Config:
        from_attributes = True


@router.get("", response_model=list[TemplateResponse])
async def list_templates(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(WorkflowTemplate).order_by(WorkflowTemplate.popularity.desc())
    if category:
        query = query.where(WorkflowTemplate.category == category)

    result = await db.execute(query)
    templates = result.scalars().all()

    return [
        TemplateResponse(
            id=t.id,
            name=t.name,
            description=t.description,
            category=t.category,
            steps_json=t.steps_json,
            icon=t.icon,
            popularity=t.popularity,
        )
        for t in templates
    ]


class PublishRequest(BaseModel):
    workflow_id: str
    category: str = "general"


@router.post("/publish")
async def publish_template(
    req: PublishRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Publish a user's workflow as a community template."""
    result = await db.execute(
        select(Workflow).where(Workflow.id == req.workflow_id, Workflow.user_id == user_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not workflow.steps_json:
        raise HTTPException(status_code=400, detail="Workflow has no steps")

    # Check if already published
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.name == workflow.name)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="A template with this name already exists")

    icon_map = {
        "finance": "receipt", "sales": "users", "marketing": "megaphone",
        "monitoring": "trending-up", "research": "newspaper", "general": "workflow",
    }

    template = WorkflowTemplate(
        name=workflow.name,
        description=workflow.description,
        category=req.category,
        steps_json=workflow.steps_json,
        icon=icon_map.get(req.category, "workflow"),
        popularity=1,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return {
        "id": template.id,
        "name": template.name,
        "category": template.category,
        "message": "Workflow published to marketplace!",
    }


@router.post("/use/{template_id}")
async def use_template(template_id: str, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkflowTemplate).where(WorkflowTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.popularity += 1

    workflow = Workflow(
        user_id=user_id,
        name=template.name,
        description=template.description,
        steps_json=template.steps_json,
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)

    return {
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "steps_json": workflow.steps_json,
    }
