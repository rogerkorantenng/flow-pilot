import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String, ForeignKey("workflow_runs.id"), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)  # navigate, click, type, extract, conditional, wait
    target: Mapped[str] = mapped_column(Text, nullable=True)  # URL, selector, or description
    value: Mapped[str | None] = mapped_column(Text, nullable=True)  # text to type, value to check
    description: Mapped[str] = mapped_column(Text, nullable=True)
    condition: Mapped[str | None] = mapped_column(Text, nullable=True)  # condition expression for conditional steps
    status: Mapped[str] = mapped_column(String, default="pending")  # pending, running, completed, failed, skipped
    screenshot_b64: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON result from step execution
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    run: Mapped["WorkflowRun"] = relationship(back_populates="steps", lazy="selectin")


from app.models.workflow_run import WorkflowRun  # noqa: E402, F811
