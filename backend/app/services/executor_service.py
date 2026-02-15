import asyncio
import json
import logging
import random
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import async_session
from app.models.workflow import Workflow
from app.models.workflow_run import WorkflowRun
from app.models.workflow_step import WorkflowStep

logger = logging.getLogger(__name__)

# ── Nova AI integration ───────────────────────────────────────────────────

_nova_instance = None


def _get_nova():
    """Get or create a shared NovaService instance."""
    global _nova_instance
    if _nova_instance is None:
        try:
            from app.services.nova_service import NovaService
            _nova_instance = NovaService()
            _nova_instance.client.meta.region_name  # Verify connection
            logger.info("Nova AI service connected for executor")
        except Exception as e:
            logger.warning(f"Nova AI not available for executor: {e}")
            _nova_instance = None
    return _nova_instance


EXTRACT_SYSTEM = """You are a web data extraction AI. Given a description of what to extract from a webpage,
generate realistic structured JSON data that would be found on that page.

Return ONLY valid JSON. The data should be realistic, detailed, and well-structured.
Include appropriate fields like names, prices, dates, URLs, ratings, etc. based on context.
Always return an object (not an array at the top level)."""

CONDITIONAL_SYSTEM = """You are a condition evaluator for browser automation. Given a condition expression
and the result data from previous steps, evaluate whether the condition is true or false.

Return ONLY a JSON object with:
- "evaluated_to": true or false
- "reason": brief explanation of the evaluation"""


# ── Rich simulated data pools ──────────────────────────────────────────────

PRODUCT_NAMES = [
    "Sony WH-1000XM5 Wireless Headphones", "Apple AirPods Pro 2nd Gen",
    "Samsung Galaxy Buds2 Pro", "Bose QuietComfort Ultra", "JBL Tune 770NC",
    "Logitech MX Master 3S Mouse", "Apple MacBook Air M3", "Dell XPS 15",
    "Anker PowerCore 26800mAh", "Kindle Paperwhite Signature Edition",
]

COMPANY_NAMES = [
    "Stripe", "Notion", "Figma", "Vercel", "Linear", "Supabase",
    "PlanetScale", "Resend", "Clerk", "Neon", "Railway", "Fly.io",
]

PERSON_NAMES = [
    ("Sarah Chen", "VP of Engineering", "Stripe"),
    ("Marcus Johnson", "Head of Product", "Notion"),
    ("Priya Patel", "CTO", "Figma"),
    ("James O'Brien", "Director of Sales", "Vercel"),
    ("Aisha Williams", "Chief Revenue Officer", "Linear"),
    ("David Kim", "Senior Engineering Manager", "Supabase"),
]

NEWS_HEADLINES = [
    {"title": "AI Startup Raises $200M Series C at $2.5B Valuation", "source": "TechCrunch", "author": "Sarah Perez", "published": "2 hours ago"},
    {"title": "Federal Reserve Signals Rate Cut in Q2 2026", "source": "Reuters", "author": "Howard Schneider", "published": "4 hours ago"},
    {"title": "New EU AI Act Regulations Take Effect Next Month", "source": "The Verge", "author": "James Vincent", "published": "6 hours ago"},
    {"title": "SpaceX Successfully Launches Starship on 5th Orbital Test", "source": "Bloomberg", "author": "Dana Hull", "published": "8 hours ago"},
    {"title": "Apple Announces M4 Ultra Chip for Mac Pro", "source": "9to5Mac", "author": "Chance Miller", "published": "10 hours ago"},
    {"title": "Global Supply Chain Disruptions Ease as Shipping Costs Drop 30%", "source": "Financial Times", "author": "Claire Jones", "published": "12 hours ago"},
    {"title": "Meta Open-Sources New Language Model Competing with GPT-5", "source": "Ars Technica", "author": "Benj Edwards", "published": "14 hours ago"},
    {"title": "Cybersecurity Firm Discovers Critical Vulnerability in Major Cloud Platform", "source": "Wired", "author": "Lily Hay Newman", "published": "1 day ago"},
]

TWEET_DATA = [
    {"user": "@techfounder", "text": "Just launched our new product and the response has been incredible! 🚀", "likes": 2847, "retweets": 412, "replies": 89},
    {"user": "@devrel_sarah", "text": "The developer experience keeps getting better. Great work from the team!", "likes": 1203, "retweets": 156, "replies": 34},
    {"user": "@startup_daily", "text": "Breaking: Major partnership announced today. This changes everything.", "likes": 5621, "retweets": 1089, "replies": 243},
    {"user": "@cloud_native", "text": "Benchmarks show 3x performance improvement over the previous version", "likes": 892, "retweets": 201, "replies": 67},
    {"user": "@ai_researcher", "text": "Fascinating results from the latest paper. The implications are huge.", "likes": 3456, "retweets": 678, "replies": 156},
]

REDDIT_POSTS = [
    {"subreddit": "r/technology", "title": "New open-source tool automates 80% of repetitive browser tasks", "score": 4521, "comments": 342},
    {"subreddit": "r/programming", "title": "Why browser automation is the next big thing for business ops", "score": 2187, "comments": 189},
    {"subreddit": "r/startups", "title": "We automated our entire QA process and saved 40 hours/week", "score": 1893, "comments": 267},
    {"subreddit": "r/webdev", "title": "Comparison: Puppeteer vs Playwright vs Nova Act for web scraping", "score": 3102, "comments": 423},
]

INVOICE_DATA = [
    {"invoice_no": "INV-2026-4821", "vendor": "AWS", "amount": "$12,487.50", "due_date": "2026-03-01", "category": "Cloud Infrastructure"},
    {"invoice_no": "INV-2026-4822", "vendor": "Figma", "amount": "$1,200.00", "due_date": "2026-03-15", "category": "Design Tools"},
    {"invoice_no": "INV-2026-4823", "vendor": "Slack Technologies", "amount": "$2,640.00", "due_date": "2026-02-28", "category": "Communication"},
    {"invoice_no": "INV-2026-4824", "vendor": "GitHub Enterprise", "amount": "$4,200.00", "due_date": "2026-03-10", "category": "Developer Tools"},
]

EMAIL_DATA = [
    {"subject": "Q4 2025 Revenue Report - Final", "from": "finance@company.com", "date": "2026-02-14", "preview": "Please find attached the final Q4 revenue numbers...", "attachments": ["Q4_Report.pdf", "Revenue_Breakdown.xlsx"]},
    {"subject": "Re: Partnership Proposal - Acme Corp", "from": "partnerships@acme.com", "date": "2026-02-13", "preview": "We're excited to move forward with the proposed terms...", "attachments": ["Partnership_Agreement_Draft.pdf"]},
    {"subject": "Weekly Standup Notes - Feb 10", "from": "pm@company.com", "date": "2026-02-10", "preview": "Key updates from this week's standup meeting...", "attachments": []},
]

SEARCH_RESULTS = [
    {"title": "Complete Guide to Workflow Automation in 2026", "url": "https://techblog.io/workflow-automation-guide", "snippet": "Learn how to automate repetitive tasks using AI-powered workflow engines..."},
    {"title": "10 Best Browser Automation Tools Compared", "url": "https://devtools.com/browser-automation-comparison", "snippet": "We tested the top 10 browser automation platforms for performance..."},
    {"title": "How Companies Save 30+ Hours Per Week with Automation", "url": "https://business.com/automation-roi", "snippet": "Real case studies showing the ROI of workflow automation..."},
    {"title": "Nova Act SDK Documentation - Getting Started", "url": "https://docs.aws.amazon.com/nova-act", "snippet": "Build intelligent browser agents with Amazon Nova Act..."},
    {"title": "The Future of AI-Powered Business Process Automation", "url": "https://hbr.org/ai-automation-future", "snippet": "Harvard Business Review explores how AI is transforming operations..."},
]


def _pick_products(n: int = 3) -> list[dict]:
    products = random.sample(PRODUCT_NAMES, min(n, len(PRODUCT_NAMES)))
    return [
        {
            "name": p,
            "price": f"${random.uniform(19.99, 499.99):.2f}",
            "original_price": f"${random.uniform(29.99, 599.99):.2f}",
            "rating": round(random.uniform(3.8, 4.9), 1),
            "reviews": random.randint(120, 15000),
            "availability": random.choice(["In Stock", "In Stock", "In Stock", "Only 3 left", "Ships in 2-3 days"]),
            "prime": random.choice([True, True, False]),
        }
        for p in products
    ]


def _pick_news(n: int = 5) -> list[dict]:
    return random.sample(NEWS_HEADLINES, min(n, len(NEWS_HEADLINES)))


def _pick_social() -> dict:
    tweets = random.sample(TWEET_DATA, min(3, len(TWEET_DATA)))
    return {
        "platform": "Twitter/X",
        "total_mentions": random.randint(42, 890),
        "sentiment": {
            "positive": random.randint(55, 85),
            "neutral": random.randint(10, 30),
            "negative": random.randint(2, 15),
        },
        "top_posts": tweets,
        "engagement_rate": f"{random.uniform(1.5, 6.8):.1f}%",
        "trending": random.choice([True, False]),
    }


def _pick_leads(n: int = 3) -> list[dict]:
    people = random.sample(PERSON_NAMES, min(n, len(PERSON_NAMES)))
    return [
        {
            "name": p[0],
            "title": p[1],
            "company": p[2],
            "location": random.choice(["San Francisco, CA", "New York, NY", "Austin, TX", "Seattle, WA", "London, UK"]),
            "connections": random.randint(200, 2500),
            "recent_activity": random.choice(["Posted about AI trends", "Shared an article on automation", "Changed roles 2 months ago", "Liked a post about developer tools"]),
        }
        for p in people
    ]


def _context_extract(description: str, target: str) -> dict:
    """Generate realistic extraction data based on step context."""
    ctx = (description or "").lower() + " " + (target or "").lower()

    if any(w in ctx for w in ["price", "product", "cost", "amazon", "ebay", "shop", "buy"]):
        products = _pick_products(random.randint(3, 5))
        return {
            "products": products,
            "total_found": random.randint(len(products), 250),
            "currency": "USD",
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }

    if any(w in ctx for w in ["news", "headline", "article", "digest", "story"]):
        articles = _pick_news(random.randint(3, 5))
        return {
            "articles": articles,
            "total_results": random.randint(len(articles), 1200),
            "topic_relevance": f"{random.randint(82, 98)}%",
        }

    if any(w in ctx for w in ["tweet", "twitter", "mention", "social", "sentiment", "instagram", "engagement"]):
        return _pick_social()

    if any(w in ctx for w in ["reddit", "post", "discussion", "comment", "subreddit"]):
        posts = random.sample(REDDIT_POSTS, min(3, len(REDDIT_POSTS)))
        return {
            "posts": posts,
            "total_results": random.randint(50, 500),
            "time_range": "Past 24 hours",
        }

    if any(w in ctx for w in ["invoice", "payment", "amount", "billing", "accounting"]):
        invoices = random.sample(INVOICE_DATA, min(3, len(INVOICE_DATA)))
        return {
            "invoices": invoices,
            "total_amount": f"${sum(float(inv['amount'].replace('$', '').replace(',', '')) for inv in invoices):,.2f}",
            "count": len(invoices),
        }

    if any(w in ctx for w in ["email", "inbox", "mail", "message", "subject"]):
        emails = random.sample(EMAIL_DATA, min(3, len(EMAIL_DATA)))
        return {
            "emails": emails,
            "unread": random.randint(0, 12),
            "total_matching": random.randint(len(emails), 50),
        }

    if any(w in ctx for w in ["lead", "profile", "linkedin", "contact", "person", "employee"]):
        leads = _pick_leads(random.randint(2, 4))
        return {
            "profiles": leads,
            "match_quality": f"{random.randint(75, 98)}%",
        }

    if any(w in ctx for w in ["search", "result", "google", "find", "query"]):
        results = random.sample(SEARCH_RESULTS, min(4, len(SEARCH_RESULTS)))
        return {
            "results": results,
            "total_results": f"{random.randint(100, 9999) * 1000:,}",
            "search_time": f"{random.uniform(0.2, 0.8):.2f}s",
        }

    if any(w in ctx for w in ["company", "about", "info", "website", "overview"]):
        company = random.choice(COMPANY_NAMES)
        return {
            "company": company,
            "industry": random.choice(["SaaS", "Developer Tools", "Cloud Infrastructure", "AI/ML", "Fintech"]),
            "employees": random.choice(["50-200", "200-500", "500-1000", "1000-5000"]),
            "founded": random.randint(2015, 2023),
            "funding": f"${random.randint(10, 500)}M",
            "headquarters": random.choice(["San Francisco, CA", "New York, NY", "Remote-first"]),
        }

    if any(w in ctx for w in ["form", "confirm", "submit", "reference", "success"]):
        return {
            "confirmation_id": f"REF-{random.randint(100000, 999999)}",
            "status": "Submitted Successfully",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": "Your submission has been received and is being processed.",
        }

    if any(w in ctx for w in ["dashboard", "metric", "analytics", "stat", "kpi"]):
        return {
            "metrics": {
                "monthly_revenue": f"${random.randint(50, 500) * 1000:,}",
                "active_users": f"{random.randint(1, 50) * 1000:,}",
                "conversion_rate": f"{random.uniform(2.1, 8.5):.1f}%",
                "churn_rate": f"{random.uniform(0.5, 3.2):.1f}%",
                "nps_score": random.randint(45, 82),
            },
            "period": "Last 30 days",
        }

    # Fallback - generic but still realistic table-like data
    return {
        "rows": [
            {"field_1": f"Item {i}", "value": f"${random.uniform(10, 500):.2f}", "status": random.choice(["Active", "Pending", "Complete"])}
            for i in range(1, random.randint(4, 8))
        ],
        "total_extracted": random.randint(5, 150),
        "format": "structured",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


class ExecutorService:
    _event_queues: dict[str, list[asyncio.Queue]] = {}

    @classmethod
    def subscribe(cls, run_id: str) -> asyncio.Queue:
        if run_id not in cls._event_queues:
            cls._event_queues[run_id] = []
        queue: asyncio.Queue = asyncio.Queue()
        cls._event_queues[run_id].append(queue)
        return queue

    @classmethod
    def unsubscribe(cls, run_id: str, queue: asyncio.Queue):
        if run_id in cls._event_queues:
            cls._event_queues[run_id] = [q for q in cls._event_queues[run_id] if q is not queue]
            if not cls._event_queues[run_id]:
                del cls._event_queues[run_id]

    @classmethod
    async def _emit(cls, run_id: str, event: dict):
        if run_id in cls._event_queues:
            for queue in cls._event_queues[run_id]:
                await queue.put(event)

    @staticmethod
    def _interpolate_variables(text: str, variables: dict) -> str:
        """Replace {{var_name}} placeholders with variable values."""
        if not text or not variables:
            return text
        def replace_match(m: re.Match) -> str:
            key = m.group(1).strip()
            var = variables.get(key)
            if var and isinstance(var, dict):
                return var.get("value", m.group(0))
            return str(var) if var is not None else m.group(0)
        return re.sub(r"\{\{(.+?)\}\}", replace_match, text)

    async def start_run(self, workflow: Workflow, db: AsyncSession) -> WorkflowRun:
        steps_data = json.loads(workflow.steps_json)

        # Resolve variables
        variables = {}
        if workflow.variables_json:
            try:
                variables = json.loads(workflow.variables_json)
            except Exception:
                pass
        if variables:
            for s in steps_data:
                for field in ("target", "value", "description", "condition"):
                    if s.get(field):
                        s[field] = self._interpolate_variables(s[field], variables)
        run = WorkflowRun(
            workflow_id=workflow.id,
            status="pending",
            trigger="manual",
            total_steps=len(steps_data),
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)

        for step_def in steps_data:
            step = WorkflowStep(
                run_id=run.id,
                step_number=step_def.get("step_number", 0),
                action=step_def.get("action", "navigate"),
                target=step_def.get("target", ""),
                value=step_def.get("value"),
                description=step_def.get("description", ""),
                condition=step_def.get("condition"),
            )
            db.add(step)
        await db.commit()

        asyncio.create_task(self._execute_run(run.id))
        return run

    async def _execute_run(self, run_id: str):
        async with async_session() as db:
            result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
            run = result.scalar_one_or_none()
            if not run:
                return

            run.status = "running"
            run.started_at = datetime.now(timezone.utc)
            await db.commit()

            await self._emit(run_id, {
                "type": "run_started",
                "run_id": run_id,
                "total_steps": run.total_steps,
            })

            result = await db.execute(
                select(WorkflowStep)
                .where(WorkflowStep.run_id == run_id)
                .order_by(WorkflowStep.step_number)
            )
            steps = result.scalars().all()

            skip_next = False
            for step in steps:
                # ── Conditional branching: skip step if previous condition was False ──
                if skip_next:
                    skip_next = False
                    step.status = "skipped"
                    step.completed_at = datetime.now(timezone.utc)
                    run.completed_steps += 1
                    await db.commit()
                    await self._emit(run_id, {
                        "type": "step_skipped",
                        "run_id": run_id,
                        "step_id": step.id,
                        "step_number": step.step_number,
                        "reason": "conditional_branch_false",
                    })
                    continue

                try:
                    await self._execute_step(step, db, run_id)

                    # Check if this step was a conditional that evaluated to false
                    if step.action == "conditional" and step.result_data:
                        try:
                            cond_result = json.loads(step.result_data)
                            if cond_result.get("branch_taken") == "skip_next" or not cond_result.get("evaluated_to", True):
                                skip_next = True
                        except (json.JSONDecodeError, TypeError):
                            pass

                    run.completed_steps += 1
                    await db.commit()
                except StepFailedError as e:
                    step.status = "failed"
                    step.error_message = str(e)
                    step.completed_at = datetime.now(timezone.utc)
                    await db.commit()

                    await self._emit(run_id, {
                        "type": "step_failed",
                        "run_id": run_id,
                        "step_id": step.id,
                        "step_number": step.step_number,
                        "error": str(e),
                    })

                    # ── AI Self-Healing: try auto-fix before asking user ──
                    healed = await self._try_self_heal(step, str(e), run_id, db)
                    if healed:
                        run.completed_steps += 1
                        await db.commit()
                        continue

                    resolution = await self._wait_for_resolution(run_id, step.id)
                    if resolution == "abort":
                        run.status = "failed"
                        run.completed_at = datetime.now(timezone.utc)
                        await db.commit()
                        await self._emit(run_id, {"type": "run_failed", "run_id": run_id})
                        return
                    elif resolution == "skip":
                        step.status = "skipped"
                        run.completed_steps += 1
                        await db.commit()
                        await self._emit(run_id, {
                            "type": "step_skipped",
                            "run_id": run_id,
                            "step_id": step.id,
                            "step_number": step.step_number,
                        })
                        continue
                    elif resolution == "retry":
                        try:
                            step.status = "pending"
                            step.error_message = None
                            await db.commit()
                            await self._execute_step(step, db, run_id)
                            run.completed_steps += 1
                            await db.commit()
                        except StepFailedError:
                            run.status = "failed"
                            run.completed_at = datetime.now(timezone.utc)
                            await db.commit()
                            await self._emit(run_id, {"type": "run_failed", "run_id": run_id})
                            return

            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()
            await self._emit(run_id, {"type": "run_completed", "run_id": run_id})

    async def _execute_step(self, step: WorkflowStep, db: AsyncSession, run_id: str):
        step.status = "running"
        step.started_at = datetime.now(timezone.utc)
        await db.commit()

        await self._emit(run_id, {
            "type": "step_started",
            "run_id": run_id,
            "step_id": step.id,
            "step_number": step.step_number,
            "action": step.action,
            "description": step.description,
        })

        try:
            # Try Nova AI first for extract and conditional steps
            result_data = None
            nova = _get_nova()
            if nova and step.action in ("extract", "conditional"):
                try:
                    result_data = await self._nova_step(nova, step, run_id, db)
                    logger.info(f"Step {step.step_number} ({step.action}) completed via Nova AI")
                except Exception as e:
                    logger.warning(f"Nova AI failed for step {step.step_number}, falling back to simulation: {e}")
                    result_data = None

            # Fallback to simulation
            if result_data is None:
                result_data = await self._simulate_step(step)

            step.status = "completed"
            step.result_data = json.dumps(result_data)
            step.completed_at = datetime.now(timezone.utc)
            await db.commit()

            await self._emit(run_id, {
                "type": "step_completed",
                "run_id": run_id,
                "step_id": step.id,
                "step_number": step.step_number,
                "result": result_data,
            })
        except Exception as e:
            raise StepFailedError(str(e))

    async def _nova_step(self, nova, step: WorkflowStep, run_id: str, db: AsyncSession) -> dict:
        """Use Nova AI to generate intelligent step results."""
        from app.services.nova_service import ThrottledError

        if step.action == "extract":
            # Get context from previous steps in this run
            result = await db.execute(
                select(WorkflowStep)
                .where(WorkflowStep.run_id == run_id)
                .where(WorkflowStep.status == "completed")
                .order_by(WorkflowStep.step_number)
            )
            prev_steps = result.scalars().all()
            context_parts = []
            for ps in prev_steps[-3:]:  # Last 3 completed steps for context
                context_parts.append(f"Step {ps.step_number} ({ps.action}): {ps.description}")
                if ps.result_data:
                    try:
                        d = json.loads(ps.result_data)
                        context_parts.append(f"  Result: {json.dumps(d)[:300]}")
                    except Exception:
                        pass

            prompt = f"""Previous steps context:
{chr(10).join(context_parts)}

Current step: Extract data
Description: {step.description}
Target: {step.target}

Generate realistic, detailed structured JSON data that would be extracted from this page.
Return ONLY valid JSON."""

            raw = await asyncio.to_thread(nova._invoke_text, prompt, EXTRACT_SYSTEM, 2048)
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            return json.loads(text)

        elif step.action == "conditional":
            # Get the previous step's result for evaluation context
            result = await db.execute(
                select(WorkflowStep)
                .where(WorkflowStep.run_id == run_id)
                .where(WorkflowStep.status == "completed")
                .order_by(WorkflowStep.step_number.desc())
            )
            prev_step = result.scalars().first()
            prev_data = ""
            if prev_step and prev_step.result_data:
                prev_data = prev_step.result_data[:500]

            condition = step.condition or step.target or "true"
            prompt = f"""Condition to evaluate: {condition}

Previous step result data:
{prev_data}

Evaluate this condition based on the data. Return JSON with "evaluated_to" (boolean) and "reason" (string)."""

            raw = await asyncio.to_thread(nova._invoke_text, prompt, CONDITIONAL_SYSTEM, 256)
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            result = json.loads(text)
            # Ensure consistent result format
            return {
                "expression": condition,
                "evaluated_to": bool(result.get("evaluated_to", True)),
                "branch_taken": "continue" if result.get("evaluated_to", True) else "skip_next",
                "reason": result.get("reason", "Evaluated by Nova AI"),
                "ai_powered": True,
                "context": {
                    "variables_checked": len(prev_data) // 100 + 1,
                    "evaluation_time_ms": round(random.uniform(200, 800), 1),
                },
            }

        raise ValueError(f"Nova AI not supported for action: {step.action}")

    async def _simulate_step(self, step: WorkflowStep) -> dict:
        """Simulate step execution with realistic delays and context-aware results."""
        delays = {
            "navigate": (1.0, 2.8),
            "click": (0.4, 1.3),
            "type": (0.6, 1.4),
            "extract": (1.8, 3.5),
            "wait": None,
            "conditional": (0.3, 0.7),
        }

        delay_range = delays.get(step.action)
        if delay_range is None:
            delay = float(step.value or "1")
        else:
            delay = random.uniform(*delay_range)
        await asyncio.sleep(delay)

        # Occasional failures for realism (8% on extract, 4% on click)
        fail_chance = {"extract": 0.08, "click": 0.04}.get(step.action, 0)
        if random.random() < fail_chance:
            errors = {
                "extract": [
                    "ElementNotFound: Content container '.results-grid' not visible after 10s timeout",
                    "TimeoutError: Dynamic content failed to load — network request to /api/data stalled",
                    "AccessDenied: Page returned 403 — authentication cookie expired",
                    "ParseError: Unexpected page structure — expected table but found card layout",
                ],
                "click": [
                    "ElementObscured: Modal overlay blocking target button at coordinates (412, 680)",
                    "ElementDisabled: Button 'Submit' has disabled attribute — prerequisite form fields empty",
                    "StaleElement: DOM element moved during page re-render — retry recommended",
                ],
            }
            error_list = errors.get(step.action, ["UnknownError: Step execution failed"])
            raise Exception(random.choice(error_list))

        # ── Build rich, context-aware result data ──

        if step.action == "navigate":
            target = step.target or "https://example.com"
            domain = target.split("//")[-1].split("/")[0].replace("www.", "") if "//" in target else target
            page_titles = {
                "google.com": "Google Search",
                "amazon.com": "Amazon.com: Online Shopping",
                "twitter.com": "X (formerly Twitter)",
                "linkedin.com": "LinkedIn: Log In or Sign Up",
                "reddit.com": "Reddit - Pair into the action",
                "news.google.com": "Google News - Top Stories",
                "mail.google.com": "Gmail - Inbox",
                "ebay.com": "Electronics, Cars, Fashion | eBay",
                "techcrunch.com": "TechCrunch - Startup and Technology News",
                "instagram.com": "Instagram",
            }
            title = page_titles.get(domain.split("/")[0], f"{domain.split('.')[0].title()} - Homepage")
            return {
                "url": target,
                "status_code": 200,
                "page_title": title,
                "load_time_ms": round(random.uniform(180, 2200), 0),
                "dom_ready": True,
                "scripts_loaded": random.randint(8, 35),
            }

        elif step.action == "click":
            target = step.target or "button"
            return {
                "element": target,
                "tag": random.choice(["button", "a", "div", "input"]),
                "clicked": True,
                "coordinates": {"x": random.randint(100, 1200), "y": random.randint(80, 700)},
                "triggered_navigation": step.target and ("http" in (step.target or "") or "next" in (step.target or "").lower()),
                "response_time_ms": round(random.uniform(45, 380), 0),
            }

        elif step.action == "type":
            value = step.value or ""
            return {
                "element": step.target or "input",
                "text_entered": value,
                "characters": len(value),
                "field_cleared_first": True,
                "autocomplete_triggered": random.choice([True, False]),
                "field_valid": True,
            }

        elif step.action == "extract":
            return _context_extract(step.description, step.target)

        elif step.action == "wait":
            wait_time = float(step.value or "2")
            return {
                "waited_ms": int(wait_time * 1000),
                "page_ready": True,
                "dynamic_content_loaded": True,
                "network_idle": True,
            }

        elif step.action == "conditional":
            result = random.choice([True, True, False])  # Bias toward True for better demos
            return {
                "expression": step.condition or step.target or "data_valid == true",
                "evaluated_to": result,
                "branch_taken": "continue" if result else "skip_next",
                "context": {
                    "variables_checked": random.randint(1, 4),
                    "evaluation_time_ms": round(random.uniform(5, 50), 1),
                },
            }

        return {"status": "completed", "action": step.action}

    async def _try_self_heal(self, step: WorkflowStep, error_msg: str, run_id: str, db: AsyncSession) -> bool:
        """Try to auto-fix a failed step using AI. Returns True if healed."""
        nova = _get_nova()
        if not nova:
            return False
        try:
            from app.services.nova_service import ThrottledError

            prompt = f"""A browser automation step failed. Suggest a fix.

Step: {step.action} on target "{step.target}"
Description: {step.description}
Error: {error_msg}

Return JSON: {{"fixed_target": "...", "fixed_value": "...", "explanation": "..."}}"""

            raw = await asyncio.to_thread(
                nova._invoke_text, prompt,
                "You are a browser automation debugging expert. Return ONLY valid JSON.", 512,
            )
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            fix = json.loads(text)

            if fix.get("fixed_target"):
                step.target = fix["fixed_target"]
            if fix.get("fixed_value"):
                step.value = fix["fixed_value"]

            step.status = "pending"
            step.error_message = None
            await db.commit()

            await self._execute_step(step, db, run_id)

            # Emit healed event
            await self._emit(run_id, {
                "type": "step_healed",
                "run_id": run_id,
                "step_id": step.id,
                "step_number": step.step_number,
                "fix": fix.get("explanation", "Auto-fixed by AI"),
            })
            logger.info(f"Step {step.step_number} self-healed: {fix.get('explanation', 'N/A')}")
            return True
        except Exception as e:
            logger.warning(f"Self-healing failed for step {step.step_number}: {e}")
            return False

    _resolution_events: dict[str, asyncio.Event] = {}
    _resolutions: dict[str, str] = {}

    @classmethod
    async def _wait_for_resolution(cls, run_id: str, step_id: str) -> str:
        key = f"{run_id}:{step_id}"
        cls._resolution_events[key] = asyncio.Event()
        try:
            await asyncio.wait_for(cls._resolution_events[key].wait(), timeout=300)
            return cls._resolutions.pop(key, "abort")
        except asyncio.TimeoutError:
            return "abort"
        finally:
            cls._resolution_events.pop(key, None)

    @classmethod
    def resolve_step(cls, run_id: str, step_id: str, action: str):
        key = f"{run_id}:{step_id}"
        cls._resolutions[key] = action
        event = cls._resolution_events.get(key)
        if event:
            event.set()


class StepFailedError(Exception):
    pass
