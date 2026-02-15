import asyncio
import json
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_id
from app.db.database import get_db
from app.models.workflow import Workflow
from app.models.workflow_run import WorkflowRun

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])

CHAT_SYSTEM = """You are FlowPilot AI Assistant — a helpful copilot for browser workflow automation.
You help users understand their workflows, analyze results, debug failures, and suggest improvements.
Be concise, practical, and friendly. Use markdown formatting for clarity.
You have access to the user's workflow and run data provided in context."""


class ChatRequest(BaseModel):
    message: str
    context: str | None = None  # Optional: workflow/run context from frontend


@router.post("")
async def chat(req: ChatRequest, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    # Gather system context scoped to current user
    wf_result = await db.execute(
        select(func.count()).select_from(Workflow).where(Workflow.user_id == user_id)
    )
    wf_count = wf_result.scalar() or 0

    run_result = await db.execute(
        select(func.count()).select_from(WorkflowRun)
        .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
        .where(Workflow.user_id == user_id)
    )
    run_count = run_result.scalar() or 0

    completed_result = await db.execute(
        select(func.count()).select_from(WorkflowRun)
        .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
        .where(Workflow.user_id == user_id, WorkflowRun.status == "completed")
    )
    completed_count = completed_result.scalar() or 0

    # Get recent workflows for context
    recent_wfs = await db.execute(
        select(Workflow)
        .where(Workflow.user_id == user_id)
        .order_by(Workflow.created_at.desc())
        .limit(5)
    )
    workflows = recent_wfs.scalars().all()
    wf_names = [w.name for w in workflows]

    system_context = f"""User's FlowPilot account:
- {wf_count} workflows ({', '.join(wf_names[:3])})
- {run_count} total runs, {completed_count} completed
- Success rate: {round(completed_count / run_count * 100) if run_count > 0 else 0}%"""

    if req.context:
        system_context += f"\n\nCurrent page context:\n{req.context}"

    # Try Nova AI
    try:
        from app.services.nova_service import NovaService
        nova = NovaService()
        if not nova._is_throttled():
            prompt = f"{system_context}\n\nUser message: {req.message}"
            raw = await asyncio.to_thread(
                nova._invoke_text, prompt, CHAT_SYSTEM, 512
            )
            return {"reply": raw.strip(), "ai_generated": True}
    except Exception as e:
        logger.warning(f"Nova chat failed: {e}")

    # Smart simulation fallback
    reply = _simulate_chat(req.message, wf_count, run_count, completed_count, wf_names)
    return {"reply": reply, "ai_generated": False}


def _simulate_chat(message: str, wf_count: int, run_count: int, completed_count: int, wf_names: list[str]) -> str:
    msg = message.lower()
    success_rate = round(completed_count / run_count * 100) if run_count > 0 else 0

    if any(w in msg for w in ["hello", "hi", "hey", "help"]):
        return f"Hey! I'm your FlowPilot AI assistant. You currently have **{wf_count} workflows** with a **{success_rate}% success rate** across {run_count} runs. How can I help? I can:\n\n- Explain how workflows work\n- Help debug failed steps\n- Suggest workflow improvements\n- Answer questions about your results"

    if any(w in msg for w in ["status", "overview", "how am i", "summary"]):
        return f"Here's your overview:\n\n- **{wf_count}** active workflows\n- **{run_count}** total runs ({completed_count} completed)\n- **{success_rate}%** success rate\n- Recent workflows: {', '.join(wf_names[:3]) if wf_names else 'None yet'}\n\nEverything looks {'good' if success_rate > 80 else 'like there are some failures to investigate'}!"

    if any(w in msg for w in ["fail", "error", "broken", "fix", "debug"]):
        return "For failed steps, here are common fixes:\n\n1. **ElementNotFound** — The page structure may have changed. Try updating the CSS selector.\n2. **Timeout** — Add a `wait` step before the failing action to let the page load.\n3. **AccessDenied** — Check if login cookies expired. Add an auth step.\n4. **ElementObscured** — A modal/popup is blocking. Add a step to close it first.\n\nYou can also click **Get AI Fix** on any failed step for specific suggestions."

    if any(w in msg for w in ["improve", "faster", "optimize", "better"]):
        return "Tips to improve your workflows:\n\n1. **Add wait steps** between navigations to avoid timing issues\n2. **Use conditional steps** to handle different page states\n3. **Break large workflows** into smaller, focused ones\n4. **Schedule off-peak** to avoid rate limiting on target sites\n5. **Extract only what you need** — smaller extractions are faster and more reliable"

    if any(w in msg for w in ["schedule", "cron", "automate", "timer"]):
        return "You can schedule workflows using cron expressions:\n\n- **Every morning at 9 AM**: `0 9 * * *`\n- **Every Monday**: `0 9 * * 1`\n- **Every hour**: `0 * * * *`\n- **Every 6 hours**: `0 */6 * * *`\n\nSet the trigger to 'Scheduled' in the workflow builder and enter your cron expression."

    if any(w in msg for w in ["create", "new", "build", "make"]):
        return "To create a new workflow:\n\n1. Go to **Workflows** → **New Workflow**\n2. Describe what you want in plain English (e.g., *\"Check prices on Amazon for headphones\"*)\n3. Click **Generate Steps** — AI will plan the automation\n4. Review and adjust steps as needed\n5. **Save** and **Run**!\n\nYou can also start from a **Template** for common tasks."

    if any(w in msg for w in ["webhook", "api", "trigger", "external"]):
        return "Each workflow has a webhook URL you can use to trigger it externally:\n\n```\ncurl -X POST /api/workflows/webhook/{workflow_id}\n```\n\nFind the webhook URL on any workflow's detail page. Great for integrating with CI/CD, Slack bots, or other services!"

    return f"I can help with your FlowPilot workflows! You have **{wf_count} workflows** and **{run_count} runs**. Try asking me about:\n\n- Your workflow status and performance\n- How to fix failed steps\n- Tips to improve reliability\n- How to set up scheduling\n- Creating new workflows"
