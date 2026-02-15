import asyncio
import json
import logging
import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_user_id
from app.db.database import get_db
from app.models.workflow import Workflow
from app.models.workflow_run import WorkflowRun
from app.models.workflow_step import WorkflowStep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/insights", tags=["insights"])


class InsightsRequest(BaseModel):
    workflow_id: str | None = None
    run_id: str | None = None


class Insight(BaseModel):
    type: str  # price_alert, trend, sentiment, comparison, anomaly, summary
    title: str
    description: str
    severity: str  # info, warning, success, critical
    data: dict | None = None


class InsightsResponse(BaseModel):
    insights: list[Insight]
    summary: str
    ai_generated: bool


def _analyze_results(results: list[dict]) -> list[Insight]:
    """Generate insights from extracted result data."""
    insights: list[Insight] = []

    for r in results:
        data = r.get("result_data")
        if not data:
            continue
        try:
            parsed = json.loads(data) if isinstance(data, str) else data
        except (json.JSONDecodeError, TypeError):
            continue

        # Price insights
        if "products" in parsed:
            products = parsed["products"]
            if products:
                cheapest = min(products, key=lambda p: float(str(p.get("price", "999")).replace("$", "").replace(",", "")))
                most_expensive = max(products, key=lambda p: float(str(p.get("price", "999")).replace("$", "").replace(",", "")))
                insights.append(Insight(
                    type="price_alert",
                    title=f"Best Deal: {cheapest.get('name', 'Product')[:40]}",
                    description=f"Lowest price found at {cheapest.get('price', 'N/A')} with {cheapest.get('rating', 'N/A')} rating. "
                                f"Most expensive option is {most_expensive.get('name', 'Product')[:30]} at {most_expensive.get('price', 'N/A')}.",
                    severity="success",
                    data={"cheapest": cheapest, "most_expensive": most_expensive, "total_products": len(products)},
                ))
                # Price range insight
                prices = []
                for p in products:
                    try:
                        prices.append(float(str(p.get("price", "0")).replace("$", "").replace(",", "")))
                    except ValueError:
                        pass
                if prices:
                    avg = sum(prices) / len(prices)
                    insights.append(Insight(
                        type="trend",
                        title=f"Average Price: ${avg:.2f}",
                        description=f"Across {len(prices)} products, prices range from ${min(prices):.2f} to ${max(prices):.2f}. "
                                    f"The spread is ${max(prices) - min(prices):.2f}.",
                        severity="info",
                        data={"average": avg, "min": min(prices), "max": max(prices), "count": len(prices)},
                    ))

        # Sentiment insights
        if "sentiment" in parsed:
            sent = parsed["sentiment"]
            neg = sent.get("negative", 0)
            pos = sent.get("positive", 0)
            if neg > 15:
                insights.append(Insight(
                    type="sentiment",
                    title="Negative Sentiment Spike Detected",
                    description=f"Negative sentiment at {neg}% exceeds normal threshold. "
                                f"Positive at {pos}%, consider reviewing recent mentions.",
                    severity="warning",
                    data=sent,
                ))
            elif pos > 70:
                insights.append(Insight(
                    type="sentiment",
                    title="Strong Positive Sentiment",
                    description=f"Positive sentiment at {pos}% — audience reception is very favorable. "
                                f"Engagement rate: {parsed.get('engagement_rate', 'N/A')}.",
                    severity="success",
                    data=sent,
                ))

        # News insights
        if "articles" in parsed:
            articles = parsed["articles"]
            if articles:
                insights.append(Insight(
                    type="summary",
                    title=f"{len(articles)} News Articles Found",
                    description=f"Top story: \"{articles[0].get('title', 'N/A')}\" from {articles[0].get('source', 'unknown')}. "
                                f"Coverage spans {len(set(a.get('source', '') for a in articles))} unique sources.",
                    severity="info",
                    data={"articles_count": len(articles), "sources": list(set(a.get("source", "") for a in articles))},
                ))

        # Invoice insights
        if "invoices" in parsed:
            invoices = parsed["invoices"]
            total = parsed.get("total_amount", "N/A")
            insights.append(Insight(
                type="comparison",
                title=f"{len(invoices)} Invoices Processed — Total: {total}",
                description=f"Categories: {', '.join(set(inv.get('category', 'Other') for inv in invoices))}. "
                            f"Highest: {max(invoices, key=lambda i: float(str(i.get('amount', '0')).replace('$', '').replace(',', ''))).get('vendor', 'N/A')}.",
                severity="info",
                data={"invoices": invoices, "total": total},
            ))

    return insights


def _generate_summary(insights: list[Insight]) -> str:
    """Generate a natural language summary from insights."""
    if not insights:
        return "No significant patterns detected in the extracted data. Run more workflows to generate insights."

    parts = []
    price_insights = [i for i in insights if i.type == "price_alert"]
    if price_insights:
        parts.append(f"Found {len(price_insights)} pricing opportunit{'y' if len(price_insights) == 1 else 'ies'}")

    sentiment_insights = [i for i in insights if i.type == "sentiment"]
    if sentiment_insights:
        for s in sentiment_insights:
            if s.severity == "warning":
                parts.append("detected a negative sentiment spike requiring attention")
            else:
                parts.append("sentiment is trending positive")

    news_insights = [i for i in insights if i.type == "summary"]
    if news_insights:
        parts.append(f"collected {sum(i.data.get('articles_count', 0) for i in news_insights if i.data)} news articles")

    trend_insights = [i for i in insights if i.type == "trend"]
    if trend_insights:
        parts.append(f"identified {len(trend_insights)} market trend{'s' if len(trend_insights) != 1 else ''}")

    if parts:
        return "FlowPilot AI analysis: " + ", ".join(parts) + ". Review the detailed insights below for actionable recommendations."
    return "Analysis complete. See detailed insights below."


@router.post("/generate", response_model=InsightsResponse)
async def generate_insights(
    req: InsightsRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    results = []

    if req.run_id:
        # Get results for a specific run
        query = (
            select(WorkflowStep)
            .join(WorkflowRun, WorkflowStep.run_id == WorkflowRun.id)
            .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
            .where(WorkflowRun.id == req.run_id, Workflow.user_id == user_id)
            .where(WorkflowStep.result_data.isnot(None))
        )
    elif req.workflow_id:
        # Get results for all runs of a workflow
        query = (
            select(WorkflowStep)
            .join(WorkflowRun, WorkflowStep.run_id == WorkflowRun.id)
            .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
            .where(Workflow.id == req.workflow_id, Workflow.user_id == user_id)
            .where(WorkflowStep.result_data.isnot(None))
            .order_by(WorkflowStep.completed_at.desc())
            .limit(50)
        )
    else:
        # Get recent results across all workflows
        query = (
            select(WorkflowStep)
            .join(WorkflowRun, WorkflowStep.run_id == WorkflowRun.id)
            .join(Workflow, WorkflowRun.workflow_id == Workflow.id)
            .where(Workflow.user_id == user_id)
            .where(WorkflowStep.result_data.isnot(None))
            .order_by(WorkflowStep.completed_at.desc())
            .limit(100)
        )

    result = await db.execute(query)
    steps = result.scalars().all()

    for step in steps:
        results.append({
            "step_number": step.step_number,
            "action": step.action,
            "description": step.description,
            "target": step.target,
            "result_data": step.result_data,
        })

    # Try Nova AI for enhanced insights
    ai_generated = False
    nova_summary = None
    try:
        from app.services.nova_service import NovaService
        nova = NovaService()
        if not nova._is_throttled() and results:
            # Prepare context for AI
            data_summary = json.dumps(results[:10], default=str)[:3000]
            prompt = f"""Analyze this workflow execution data and provide 2-3 actionable business insights:

{data_summary}

Return a brief 2-3 sentence executive summary highlighting key findings, trends, and recommendations."""

            raw = await asyncio.to_thread(
                nova._invoke_text, prompt,
                "You are a business analyst AI. Provide concise, actionable insights from workflow data.",
                512,
            )
            nova_summary = raw.strip()
            ai_generated = True
    except Exception as e:
        logger.warning(f"Nova insights failed: {e}")

    insights = _analyze_results(results)
    summary = nova_summary or _generate_summary(insights)

    return InsightsResponse(
        insights=insights,
        summary=summary,
        ai_generated=ai_generated,
    )
