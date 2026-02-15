import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id: Mapped[str] = mapped_column(String, ForeignKey("workflows.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending, running, completed, failed, cancelled
    trigger: Mapped[str] = mapped_column(String, default="manual")  # manual, scheduled, webhook
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    completed_steps: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    workflow: Mapped["Workflow"] = relationship(back_populates="runs", lazy="selectin")
    steps: Mapped[list["WorkflowStep"]] = relationship(back_populates="run", lazy="selectin")


from app.models.workflow import Workflow  # noqa: E402, F811
from app.models.workflow_step import WorkflowStep  # noqa: E402
