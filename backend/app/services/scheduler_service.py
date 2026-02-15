import json
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.db.database import async_session
from app.models.workflow import Workflow

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def execute_scheduled_workflow(workflow_id: str):
    from app.services.executor_service import ExecutorService

    async with async_session() as db:
        result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
        workflow = result.scalar_one_or_none()
        if not workflow or not workflow.steps_json:
            logger.warning(f"Scheduled workflow {workflow_id} not found or has no steps")
            return

        executor = ExecutorService()
        run = await executor.start_run(workflow, db)
        logger.info(f"Scheduled run {run.id} started for workflow {workflow_id}")


async def load_scheduled_workflows():
    async with async_session() as db:
        result = await db.execute(
            select(Workflow).where(
                Workflow.trigger_type == "scheduled",
                Workflow.status == "active",
                Workflow.schedule_cron.isnot(None),
            )
        )
        workflows = result.scalars().all()

        for workflow in workflows:
            add_workflow_schedule(workflow.id, workflow.schedule_cron)
        logger.info(f"Loaded {len(workflows)} scheduled workflows")


def add_workflow_schedule(workflow_id: str, cron_expression: str):
    job_id = f"workflow_{workflow_id}"
    try:
        # Remove existing job if any
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)

        # Parse cron expression (minute hour day_of_month month day_of_week)
        parts = cron_expression.split()
        if len(parts) == 5:
            trigger = CronTrigger(
                minute=parts[0],
                hour=parts[1],
                day=parts[2],
                month=parts[3],
                day_of_week=parts[4],
            )
            scheduler.add_job(
                execute_scheduled_workflow,
                trigger=trigger,
                args=[workflow_id],
                id=job_id,
                replace_existing=True,
            )
            logger.info(f"Scheduled workflow {workflow_id} with cron: {cron_expression}")
    except Exception as e:
        logger.error(f"Failed to schedule workflow {workflow_id}: {e}")


def remove_workflow_schedule(workflow_id: str):
    job_id = f"workflow_{workflow_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
