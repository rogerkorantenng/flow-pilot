import asyncio
import json
import logging
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_id
from app.db.database import get_db
from app.models.workflow import Workflow
from app.models.workflow_run import WorkflowRun
from app.models.workflow_template import WorkflowTemplate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])

CHAT_SYSTEM = """You are FlowPilot AI Assistant — a fully capable copilot that can perform ANY action in the app.
Be concise, practical, and friendly. Use markdown formatting.

You MUST include an @@ACTION block at the end of your reply when the user wants to DO something.
Supported actions (include on its own line at the very end):

@@ACTION:{"type":"create_workflow","description":"<desc>"}
@@ACTION:{"type":"run_workflow","name":"<name>"}
@@ACTION:{"type":"delete_workflow","name":"<name>"}
@@ACTION:{"type":"clone_workflow","name":"<name>"}
@@ACTION:{"type":"edit_workflow","name":"<name>"}
@@ACTION:{"type":"view_workflow","name":"<name>"}
@@ACTION:{"type":"publish_workflow","name":"<name>","category":"<cat>"}
@@ACTION:{"type":"use_template","name":"<template name>"}
@@ACTION:{"type":"list_workflows"}
@@ACTION:{"type":"list_templates"}
@@ACTION:{"type":"list_runs"}
@@ACTION:{"type":"view_results"}
@@ACTION:{"type":"generate_insights"}
@@ACTION:{"type":"check_ai_status"}
@@ACTION:{"type":"navigate","path":"<path>"}
@@ACTION:{"type":"change_name","name":"<new name>"}
@@ACTION:{"type":"view_last_run"}
@@ACTION:{"type":"abort_run"}
@@ACTION:{"type":"summarize_last_run"}

Only ONE action per response. Only include if the user wants an action performed."""


class ChatRequest(BaseModel):
    message: str
    context: str | None = None


@router.post("")
async def chat(req: ChatRequest, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    # ── Gather full context ──
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

    # Workflows
    recent_wfs = await db.execute(
        select(Workflow).where(Workflow.user_id == user_id).order_by(Workflow.created_at.desc()).limit(20)
    )
    workflows = recent_wfs.scalars().all()
    wf_names = [w.name for w in workflows]
    wf_map = {w.name.lower().strip(): w for w in workflows}

    # Templates
    tpl_result = await db.execute(select(WorkflowTemplate).order_by(WorkflowTemplate.popularity.desc()).limit(20))
    templates = tpl_result.scalars().all()
    tpl_map = {t.name.lower().strip(): t for t in templates}
    tpl_names = [t.name for t in templates]

    # Last run
    last_run_result = await db.execute(
        select(WorkflowRun)
        .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
        .where(Workflow.user_id == user_id)
        .order_by(WorkflowRun.created_at.desc())
        .limit(1)
    )
    last_run = last_run_result.scalar_one_or_none()

    success_rate = round(completed_count / run_count * 100) if run_count > 0 else 0

    system_context = f"""User's account:
- {wf_count} workflows: {', '.join(wf_names[:8])}
- {run_count} runs, {completed_count} completed, {success_rate}% success
- Templates available: {', '.join(tpl_names[:5])}
- Last run: {last_run.id if last_run else 'none'} ({last_run.status if last_run else 'n/a'})"""

    if req.context:
        system_context += f"\nPage context: {req.context}"

    # ── Try Nova AI ──
    reply = None
    ai_generated = False
    try:
        from app.services.nova_service import NovaService
        nova = NovaService()
        if not nova._is_throttled():
            prompt = f"{system_context}\n\nUser: {req.message}"
            raw = await asyncio.to_thread(nova._invoke_text, prompt, CHAT_SYSTEM, 512)
            reply = raw.strip()
            ai_generated = True
    except Exception as e:
        logger.warning(f"Nova chat failed: {e}")

    # ── Fallback to rule-based ──
    if reply is None:
        reply, action = _simulate_chat(
            req.message, wf_count, run_count, completed_count,
            wf_names, wf_map, tpl_names, tpl_map, last_run,
        )
        if action:
            return {"reply": reply, "ai_generated": False, "action": action}
        return {"reply": reply, "ai_generated": False}

    # ── Parse action from AI reply ──
    action = _parse_action(reply, wf_map, tpl_map, last_run)
    if action:
        reply = re.sub(r'\n?@@ACTION:\{.*\}', '', reply).strip()

    response: dict = {"reply": reply, "ai_generated": ai_generated}
    if action:
        response["action"] = action
    return response


def _parse_action(reply: str, wf_map: dict, tpl_map: dict, last_run) -> dict | None:
    match = re.search(r'@@ACTION:(\{.*\})', reply)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
        return _resolve_action(data, wf_map, tpl_map, last_run)
    except (json.JSONDecodeError, TypeError):
        return None


def _resolve_action(data: dict, wf_map: dict, tpl_map: dict, last_run) -> dict | None:
    t = data.get("type")
    name = (data.get("name") or "").lower().strip()

    # Find workflow by fuzzy match
    def find_wf(n):
        if n in wf_map:
            return wf_map[n]
        for k, v in wf_map.items():
            if n in k or k in n:
                return v
        return None

    def find_tpl(n):
        if n in tpl_map:
            return tpl_map[n]
        for k, v in tpl_map.items():
            if n in k or k in n:
                return v
        return None

    if t == "create_workflow":
        return {"type": "create_workflow", "description": data.get("description", "")}
    elif t == "run_workflow":
        wf = find_wf(name)
        if wf:
            return {"type": "run_workflow", "workflow_id": wf.id, "workflow_name": wf.name}
        return {"type": "not_found", "message": f"Workflow '{data.get('name', '')}' not found"}
    elif t == "delete_workflow":
        wf = find_wf(name)
        if wf:
            return {"type": "delete_workflow", "workflow_id": wf.id, "workflow_name": wf.name}
        return {"type": "not_found", "message": f"Workflow '{data.get('name', '')}' not found"}
    elif t == "clone_workflow":
        wf = find_wf(name)
        if wf:
            return {"type": "clone_workflow", "workflow_id": wf.id, "workflow_name": wf.name}
        return {"type": "not_found", "message": f"Workflow '{data.get('name', '')}' not found"}
    elif t == "edit_workflow":
        wf = find_wf(name)
        if wf:
            return {"type": "navigate", "path": f"/workflows/{wf.id}/edit"}
        return {"type": "not_found", "message": f"Workflow '{data.get('name', '')}' not found"}
    elif t == "view_workflow":
        wf = find_wf(name)
        if wf:
            return {"type": "navigate", "path": f"/workflows/{wf.id}"}
        return {"type": "not_found", "message": f"Workflow '{data.get('name', '')}' not found"}
    elif t == "publish_workflow":
        wf = find_wf(name)
        if wf:
            return {"type": "publish_workflow", "workflow_id": wf.id, "workflow_name": wf.name, "category": data.get("category", "general")}
        return {"type": "not_found", "message": f"Workflow '{data.get('name', '')}' not found"}
    elif t == "use_template":
        tpl = find_tpl(name)
        if tpl:
            return {"type": "use_template", "template_id": tpl.id, "template_name": tpl.name}
        return {"type": "not_found", "message": f"Template '{data.get('name', '')}' not found"}
    elif t == "list_workflows":
        return {"type": "navigate", "path": "/workflows"}
    elif t == "list_templates":
        return {"type": "navigate", "path": "/templates"}
    elif t == "list_runs":
        return {"type": "navigate", "path": "/workflows"}
    elif t == "view_results":
        return {"type": "navigate", "path": "/results"}
    elif t == "generate_insights":
        return {"type": "generate_insights"}
    elif t == "check_ai_status":
        return {"type": "check_ai_status"}
    elif t == "navigate":
        return {"type": "navigate", "path": data.get("path", "/")}
    elif t == "change_name":
        return {"type": "change_name", "name": data.get("name", "")}
    elif t == "view_last_run":
        if last_run:
            return {"type": "navigate", "path": f"/runs/{last_run.id}"}
        return {"type": "not_found", "message": "No runs found"}
    elif t == "abort_run":
        if last_run and last_run.status == "running":
            return {"type": "abort_run", "run_id": last_run.id}
        return {"type": "not_found", "message": "No running run to abort"}
    elif t == "summarize_last_run":
        if last_run:
            return {"type": "summarize_run", "run_id": last_run.id}
        return {"type": "not_found", "message": "No runs found"}
    return None


def _simulate_chat(
    message: str, wf_count: int, run_count: int, completed_count: int,
    wf_names: list[str], wf_map: dict,
    tpl_names: list[str], tpl_map: dict, last_run,
) -> tuple[str, dict | None]:
    msg = message.lower().strip()
    success_rate = round(completed_count / run_count * 100) if run_count > 0 else 0

    def find_wf_in_msg():
        for name, wf in wf_map.items():
            if name in msg:
                return wf
        return None

    def find_tpl_in_msg():
        for name, tpl in tpl_map.items():
            if name in msg:
                return tpl
        return None

    # ── CREATE WORKFLOW ──
    if _intent(msg, ["create", "build", "make", "generate"], ["workflow", "automation", "flow", "bot"]):
        name, desc = _extract_create_info(message, msg)
        action: dict = {"type": "create_workflow", "description": desc or "", "name": name or ""}
        if name and desc:
            return (
                f"Sure! I'll create **{name}** — *\"{desc}\"*. Let me guide you through the rest.",
                action,
            )
        elif desc and len(desc) >= 5:
            return (
                f"Sure! Let's create a workflow for **\"{desc}\"**. I'll guide you through it step by step.",
                action,
            )
        elif name:
            return (
                f"Sure! Let's create **{name}**. I'll guide you through it step by step.",
                action,
            )
        return (
            "Sure! Let's create a new workflow. I'll guide you through it step by step.",
            action,
        )

    # ── RUN WORKFLOW ──
    if _intent(msg, ["run", "execute", "start", "launch", "trigger"], ["workflow", "automation", "flow"]):
        wf = find_wf_in_msg()
        if wf:
            return (
                f"Starting **{wf.name}**... Opening the live execution viewer.",
                {"type": "run_workflow", "workflow_id": wf.id, "workflow_name": wf.name},
            )
        if wf_names:
            return (
                f"Which workflow? Here are yours:\n\n" + "\n".join(f"- **{n}**" for n in wf_names[:8]) + "\n\nSay \"run [name]\".",
                {"type": "navigate", "path": "/workflows"},
            )
        return ("You don't have any workflows yet. Say **\"create a workflow that...\"** and I'll build one!", None)

    # ── DELETE WORKFLOW ──
    if _intent(msg, ["delete", "remove", "destroy"], ["workflow", "automation", "flow"]):
        wf = find_wf_in_msg()
        if wf:
            return (
                f"I'll delete **{wf.name}** and all its runs. Click the button to confirm.",
                {"type": "delete_workflow", "workflow_id": wf.id, "workflow_name": wf.name},
            )
        if wf_names:
            return (
                "Which workflow should I delete?\n\n" + "\n".join(f"- {n}" for n in wf_names[:8]),
                None,
            )
        return ("You don't have any workflows to delete.", None)

    # ── CLONE/DUPLICATE WORKFLOW ──
    if _intent(msg, ["clone", "duplicate", "copy"], ["workflow", "automation", "flow"]):
        wf = find_wf_in_msg()
        if wf:
            return (
                f"Cloning **{wf.name}**... This creates an exact copy you can modify.",
                {"type": "clone_workflow", "workflow_id": wf.id, "workflow_name": wf.name},
            )
        if wf_names:
            return (
                "Which workflow should I clone?\n\n" + "\n".join(f"- {n}" for n in wf_names[:8]),
                None,
            )
        return ("You don't have any workflows to clone.", None)

    # ── EDIT WORKFLOW ──
    if _intent(msg, ["edit", "modify", "change", "update"], ["workflow", "automation", "flow", "step"]):
        wf = find_wf_in_msg()
        if wf:
            return (
                f"Opening the editor for **{wf.name}**...",
                {"type": "navigate", "path": f"/workflows/{wf.id}/edit"},
            )
        if wf_names:
            return (
                "Which workflow should I edit?\n\n" + "\n".join(f"- {n}" for n in wf_names[:8]),
                {"type": "navigate", "path": "/workflows"},
            )
        return ("You don't have any workflows to edit. Want me to create one?", None)

    # ── PUBLISH WORKFLOW ──
    if _intent(msg, ["publish", "share"], ["workflow", "template", "marketplace"]):
        wf = find_wf_in_msg()
        if wf:
            cat = "general"
            for c in ["finance", "sales", "marketing", "monitoring", "research"]:
                if c in msg:
                    cat = c
                    break
            return (
                f"Publishing **{wf.name}** to the marketplace as **{cat}**...",
                {"type": "publish_workflow", "workflow_id": wf.id, "workflow_name": wf.name, "category": cat},
            )
        if wf_names:
            return (
                "Which workflow should I publish?\n\n" + "\n".join(f"- {n}" for n in wf_names[:8]),
                None,
            )
        return ("You don't have any workflows to publish.", None)

    # ── USE TEMPLATE ──
    if _intent(msg, ["use", "install", "apply", "try"], ["template"]):
        tpl = find_tpl_in_msg()
        if tpl:
            return (
                f"Creating a workflow from the **{tpl.name}** template...",
                {"type": "use_template", "template_id": tpl.id, "template_name": tpl.name},
            )
        if tpl_names:
            return (
                "Which template? Here are the available ones:\n\n" + "\n".join(f"- **{n}**" for n in tpl_names[:8]),
                {"type": "navigate", "path": "/templates"},
            )
        return ("No templates available right now.", None)

    # ── VIEW SPECIFIC WORKFLOW ──
    if _intent(msg, ["view", "show", "open", "detail"], ["workflow"]) and not _intent(msg, ["all", "list", "my"], []):
        wf = find_wf_in_msg()
        if wf:
            return (
                f"Opening **{wf.name}**...",
                {"type": "navigate", "path": f"/workflows/{wf.id}"},
            )

    # ── LIST WORKFLOWS ──
    if _intent(msg, ["list", "show", "all", "what"], ["workflow"]):
        if wf_names:
            return (
                f"You have **{wf_count}** workflows:\n\n" + "\n".join(f"- **{n}**" for n in wf_names),
                {"type": "navigate", "path": "/workflows"},
            )
        return ("You don't have any workflows yet. Want me to create one?", None)

    # ── LIST TEMPLATES ──
    if _intent(msg, ["list", "show", "browse", "what", "available"], ["template", "marketplace"]):
        if tpl_names:
            return (
                f"Available templates:\n\n" + "\n".join(f"- **{n}**" for n in tpl_names[:8]),
                {"type": "navigate", "path": "/templates"},
            )
        return ("No templates available.", {"type": "navigate", "path": "/templates"})

    # ── VIEW RUNS ──
    if _intent(msg, ["show", "list", "view", "my"], ["run", "execution", "history"]):
        if last_run:
            return (
                f"Your latest run: **{last_run.status}** ({last_run.completed_steps}/{last_run.total_steps} steps). Opening it...",
                {"type": "navigate", "path": f"/runs/{last_run.id}"},
            )
        return ("No runs yet. Run a workflow first!", None)

    # ── VIEW LAST RUN ──
    if any(w in msg for w in ["last run", "latest run", "recent run"]):
        if last_run:
            return (
                f"Your latest run is **{last_run.status}** ({last_run.completed_steps}/{last_run.total_steps} steps). Opening it...",
                {"type": "navigate", "path": f"/runs/{last_run.id}"},
            )
        return ("No runs found yet.", None)

    # ── ABORT/STOP RUN ──
    if _intent(msg, ["abort", "stop", "cancel", "kill"], ["run", "execution"]):
        if last_run and last_run.status == "running":
            return (
                f"Aborting the current run...",
                {"type": "abort_run", "run_id": last_run.id},
            )
        return ("No running execution to abort.", None)

    # ── SUMMARIZE RUN ──
    if _intent(msg, ["summarize", "summary", "recap"], ["run", "execution", "last"]):
        if last_run:
            return (
                f"Generating a summary of your last run...",
                {"type": "summarize_run", "run_id": last_run.id},
            )
        return ("No runs to summarize yet.", None)

    # ── VIEW RESULTS / DATA ──
    if _intent(msg, ["show", "view", "see", "open", "my"], ["result", "data", "extract"]):
        return (
            "Opening the Results dashboard with all your extracted data...",
            {"type": "navigate", "path": "/results"},
        )

    # ── GENERATE INSIGHTS ──
    if _intent(msg, ["analyze", "insight", "trend", "pattern"], ["data", "result", "insight"]) or "generate insight" in msg or "ai insight" in msg:
        return (
            "Analyzing your extracted data for trends, alerts, and recommendations...",
            {"type": "generate_insights"},
        )

    # ── CHECK AI STATUS ──
    if _intent(msg, ["check", "what", "how", "is"], ["ai", "nova", "model", "status", "connected"]):
        return (
            "Checking AI model status...",
            {"type": "check_ai_status"},
        )

    # ── CHANGE NAME ──
    if _intent(msg, ["change", "set", "update", "switch"], ["name", "profile", "user", "account"]):
        # Try to extract the new name
        patterns = [
            r"(?:change|set|update|switch)\s+(?:my\s+)?name\s+to\s+[\"']?(.+?)[\"']?\s*$",
            r"(?:call me|i am|i'm)\s+[\"']?(.+?)[\"']?\s*$",
        ]
        for pat in patterns:
            m = re.search(pat, msg)
            if m:
                new_name = m.group(1).strip().strip("\"'")
                return (
                    f"Switching your profile to **{new_name}**...",
                    {"type": "change_name", "name": new_name},
                )
        return ("What should your new name be? Say \"change my name to [name]\".", None)

    # ── NAVIGATE ──
    if any(w in msg for w in ["go to", "open", "navigate to", "take me to", "show me the"]):
        page_map = {
            "dashboard": "/", "home": "/",
            "workflow": "/workflows",
            "result": "/results", "data": "/results",
            "template": "/templates", "marketplace": "/templates",
            "setting": "/settings",
            "guide": "/guide", "help page": "/guide",
        }
        for keyword, path in page_map.items():
            if keyword in msg:
                return (
                    f"Taking you to **{keyword.capitalize()}**...",
                    {"type": "navigate", "path": path},
                )

    # ── GREETINGS ──
    if any(w in msg for w in ["hello", "hi", "hey", "help", "what can you do"]):
        return (
            f"Hey! I'm your FlowPilot AI copilot. You have **{wf_count} workflows** with **{success_rate}% success rate**.\n\n"
            "I can **do everything** for you:\n\n"
            "**Create & Manage:**\n"
            "- *\"Create a workflow that checks Amazon prices\"*\n"
            "- *\"Clone my Price Monitor\"*\n"
            "- *\"Delete the old workflow\"*\n"
            "- *\"Edit my Social Media Monitor\"*\n"
            "- *\"Publish my workflow to the marketplace\"*\n\n"
            "**Execute & Monitor:**\n"
            "- *\"Run my Price Monitor\"*\n"
            "- *\"Show my last run\"*\n"
            "- *\"Abort the current run\"*\n"
            "- *\"Summarize my last run\"*\n\n"
            "**Data & Insights:**\n"
            "- *\"Show my results\"*\n"
            "- *\"Analyze my data\"*\n"
            "- *\"Check AI status\"*\n\n"
            "**Navigate & Setup:**\n"
            "- *\"Go to templates\"*\n"
            "- *\"Use the Social Media Monitor template\"*\n"
            "- *\"Change my name to Alice\"*\n",
            None,
        )

    # ── INFO RESPONSES ──
    if any(w in msg for w in ["status", "overview", "how am i", "summary"]):
        return (
            f"**Your Overview:**\n\n- **{wf_count}** workflows\n- **{run_count}** runs ({completed_count} completed)\n- **{success_rate}%** success rate\n- Recent: {', '.join(wf_names[:3]) if wf_names else 'None'}\n\n"
            f"{'Looking good!' if success_rate > 80 else 'Some failures to investigate.'}",
            None,
        )

    if any(w in msg for w in ["fail", "error", "broken", "fix", "debug"]):
        return (
            "Common fixes for failed steps:\n\n"
            "1. **ElementNotFound** — Update the CSS selector\n"
            "2. **Timeout** — Add a `wait` step before the action\n"
            "3. **AccessDenied** — Add an authentication step\n"
            "4. **ElementObscured** — Close blocking modals first\n\n"
            "Click **Get AI Fix** on any failed step, or say *\"summarize my last run\"*.",
            None,
        )

    if any(w in msg for w in ["schedule", "cron"]):
        return (
            "Schedule workflows with cron:\n\n"
            "- `0 9 * * *` — Daily at 9 AM\n"
            "- `0 * * * *` — Every hour\n"
            "- `0 9 * * 1` — Every Monday\n"
            "- `0 */6 * * *` — Every 6 hours\n\n"
            "Or just say *\"Create a workflow that checks prices every morning\"* and I'll auto-detect the schedule!",
            None,
        )

    if any(w in msg for w in ["webhook", "api", "external"]):
        return (
            "Each workflow has a webhook URL:\n\n"
            "```\ncurl -X POST /api/workflows/webhook/{id}\n```\n\n"
            "Find it on any workflow's detail page (click the Webhook section to expand). "
            "You can also say *\"show me [workflow name]\"* and I'll take you there.",
            None,
        )

    # ── DEFAULT ──
    return (
        f"You have **{wf_count} workflows** and **{run_count} runs**.\n\n"
        "Tell me what to do! I can:\n"
        "- **Create** — *\"Create a workflow that monitors Hacker News\"*\n"
        "- **Run** — *\"Run my Price Monitor\"*\n"
        "- **Delete/Clone/Edit** — *\"Clone my workflow\"*\n"
        "- **Publish** — *\"Publish my workflow to the marketplace\"*\n"
        "- **Use template** — *\"Use the Invoice Processor template\"*\n"
        "- **Analyze** — *\"Analyze my data\"*\n"
        "- **Navigate** — *\"Go to results\"*\n"
        "- **And more!** Just ask.",
        None,
    )


def _intent(msg: str, verbs: list[str], nouns: list[str]) -> bool:
    """Check if message contains any verb AND any noun."""
    has_verb = any(v in msg for v in verbs)
    if not nouns:
        return has_verb
    has_noun = any(n in msg for n in nouns)
    return has_verb and has_noun


def _extract_create_info(original: str, lower: str) -> tuple[str, str]:
    """Extract workflow name and description from the user message.

    Supports patterns like:
      "create a workflow named LinkedIn Jobs that gets backend jobs"
      "create a workflow called Price Monitor to check Amazon prices"
      "create a workflow that checks prices" (no name)
    Returns (name, description).
    """
    # Strip the verb prefix first
    remainder = original
    remainder_lower = lower
    for prefix in [
        "create a workflow ", "create workflow ", "build a workflow ",
        "make a workflow ", "generate a workflow ",
        "create a ", "build a ", "make a ", "generate a ",
        "create ", "build ", "make ", "generate ",
    ]:
        idx = remainder_lower.find(prefix)
        if idx != -1:
            remainder = remainder[idx + len(prefix):].strip()
            remainder_lower = remainder.lower()
            break

    # Try to extract "named X that/to/for/which ..." or "called X that/to/for/which ..."
    name = ""
    desc = remainder
    name_pattern = re.match(
        r'(?:named|called)\s+["\']?(.+?)["\']?\s+(?:that|to|for|which|and)\s+(.+)',
        remainder_lower,
    )
    if name_pattern:
        name_start = name_pattern.start(1)
        name_end = name_pattern.end(1)
        desc_start = name_pattern.start(2)
        name = remainder[name_start:name_end].strip()
        desc = remainder[desc_start:].strip()
    else:
        # Try "named X" without description connector
        name_only = re.match(r'(?:named|called)\s+["\']?(.+?)["\']?\s*$', remainder_lower)
        if name_only:
            name = remainder[name_only.start(1):name_only.end(1)].strip()
            desc = ""
        else:
            # No name — strip "that/to/for" prefixes from description
            for conn in ["that ", "to ", "for ", "which "]:
                if remainder_lower.startswith(conn):
                    desc = remainder[len(conn):].strip()
                    break

    return (name, desc)


def _extract_description(original: str, lower: str) -> str:
    """Legacy helper — returns just the description."""
    _, desc = _extract_create_info(original, lower)
    return desc if desc and len(desc) >= 5 else original
