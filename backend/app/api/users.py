from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.seed_data import seed_demo_workflows

router = APIRouter(prefix="/api/users", tags=["users"])


class EnterRequest(BaseModel):
    name: str


class EnterResponse(BaseModel):
    id: str
    name: str
    is_new: bool


@router.post("/enter", response_model=EnterResponse)
async def enter_user(req: EnterRequest, db: AsyncSession = Depends(get_db)):
    """Find or create a user by name (case-insensitive). Seeds demo data for new users."""
    name = req.name.strip()
    if not name:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    # Case-insensitive lookup
    result = await db.execute(
        select(User).where(func.lower(User.name) == name.lower())
    )
    user = result.scalar_one_or_none()

    if user:
        return EnterResponse(id=user.id, name=user.name, is_new=False)

    # Create new user
    user = User(name=name)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Seed demo workflows for the new user
    await seed_demo_workflows(user.id)

    return EnterResponse(id=user.id, name=user.name, is_new=True)
