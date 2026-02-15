import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    steps_json: Mapped[str] = mapped_column(Text, nullable=True)  # JSON array of step definitions
    trigger_type: Mapped[str] = mapped_column(String, default="manual")  # manual, scheduled, webhook
    schedule_cron: Mapped[str | None] = mapped_column(String, nullable=True)
    variables_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON dict of {name: {value, secret}}
    status: Mapped[str] = mapped_column(String, default="active")  # active, paused, archived
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    runs: Mapped[list["WorkflowRun"]] = relationship(back_populates="workflow", lazy="selectin")


from app.models.workflow_run import WorkflowRun  # noqa: E402
