import json
from copy import deepcopy

from sqlalchemy import select

from app.db.database import async_session
from app.models.workflow import Workflow
from app.models.workflow_template import WorkflowTemplate

TEMPLATES = [
    {
        "name": "Invoice Processing",
        "description": "Automatically process incoming invoices: extract data, validate amounts, and update accounting system.",
        "category": "finance",
        "icon": "receipt",
        "popularity": 142,
        "steps_json": json.dumps([
            {"step_number": 1, "action": "navigate", "target": "https://mail.google.com", "description": "Open email inbox"},
            {"step_number": 2, "action": "type", "target": "Search bar", "value": "subject:invoice has:attachment", "description": "Search for invoice emails"},
            {"step_number": 3, "action": "extract", "target": "Extract invoice number, amount, and due date from emails", "description": "Extract invoice data"},
            {"step_number": 4, "action": "navigate", "target": "https://accounting.example.com", "description": "Open accounting system"},
            {"step_number": 5, "action": "type", "target": "New entry form", "value": "{{extracted_data}}", "description": "Enter invoice data"},
            {"step_number": 6, "action": "click", "target": "Submit button", "description": "Submit invoice entry"},
            {"step_number": 7, "action": "extract", "target": "Confirmation message and reference number", "description": "Capture confirmation"},
        ]),
    },
    {
        "name": "Lead Research",
        "description": "Research new leads: visit LinkedIn profiles, gather company info, and compile research summary.",
        "category": "sales",
        "icon": "users",
        "popularity": 98,
        "steps_json": json.dumps([
            {"step_number": 1, "action": "navigate", "target": "https://linkedin.com", "description": "Open LinkedIn"},
            {"step_number": 2, "action": "type", "target": "Search bar", "value": "{{lead_name}}", "description": "Search for lead"},
            {"step_number": 3, "action": "click", "target": "First search result profile", "description": "Open lead profile"},
            {"step_number": 4, "action": "extract", "target": "Extract job title, company, location, and recent activity from LinkedIn profile", "description": "Extract profile data"},
            {"step_number": 5, "action": "navigate", "target": "{{company_website}}", "description": "Visit company website"},
            {"step_number": 6, "action": "extract", "target": "Extract company size, industry, funding, and recent news", "description": "Extract company info"},
        ]),
    },
    {
        "name": "Social Media Monitor",
        "description": "Monitor social media mentions: check Twitter, Reddit, and news sites for brand mentions and sentiment.",
        "category": "marketing",
        "icon": "megaphone",
        "popularity": 215,
        "steps_json": json.dumps([
            {"step_number": 1, "action": "navigate", "target": "https://twitter.com/search", "description": "Open Twitter search"},
            {"step_number": 2, "action": "type", "target": "Search input", "value": "{{brand_name}}", "description": "Search for brand mentions"},
            {"step_number": 3, "action": "extract", "target": "Extract recent tweets, engagement metrics, and sentiment analysis", "description": "Extract Twitter mentions"},
            {"step_number": 4, "action": "navigate", "target": "https://reddit.com/search", "description": "Open Reddit search"},
            {"step_number": 5, "action": "type", "target": "Search input", "value": "{{brand_name}}", "description": "Search Reddit"},
            {"step_number": 6, "action": "extract", "target": "Extract top Reddit posts and discussions mentioning the brand", "description": "Extract Reddit mentions"},
            {"step_number": 7, "action": "conditional", "target": "Check sentiment", "condition": "negative_mentions > 10", "description": "Alert if negative sentiment spike"},
        ]),
    },
    {
        "name": "Competitor Price Check",
        "description": "Check competitor prices across Amazon and eBay, compare products, and track price changes.",
        "category": "monitoring",
        "icon": "trending-up",
        "popularity": 176,
        "steps_json": json.dumps([
            {"step_number": 1, "action": "navigate", "target": "https://www.amazon.com", "description": "Open Amazon"},
            {"step_number": 2, "action": "type", "target": "Search bar", "value": "wireless headphones", "description": "Search for product"},
            {"step_number": 3, "action": "extract", "target": "Extract product names, prices, ratings, and review counts from Amazon", "description": "Extract Amazon pricing"},
            {"step_number": 4, "action": "navigate", "target": "https://www.ebay.com", "description": "Open eBay"},
            {"step_number": 5, "action": "type", "target": "Search bar", "value": "wireless headphones", "description": "Search on eBay"},
            {"step_number": 6, "action": "extract", "target": "Extract product names, prices, and listing details from eBay", "description": "Extract eBay pricing"},
            {"step_number": 7, "action": "conditional", "target": "Compare prices", "condition": "price_diff > 15%", "description": "Flag significant price differences"},
        ]),
    },
    {
        "name": "Daily News Digest",
        "description": "Compile a daily news digest from Google News, TechCrunch, and Reddit on a specific topic.",
        "category": "research",
        "icon": "newspaper",
        "popularity": 89,
        "steps_json": json.dumps([
            {"step_number": 1, "action": "navigate", "target": "https://news.google.com", "description": "Open Google News"},
            {"step_number": 2, "action": "type", "target": "Search input", "value": "artificial intelligence", "description": "Search for AI news"},
            {"step_number": 3, "action": "extract", "target": "Extract top 5 news headlines with sources and timestamps", "description": "Extract news headlines"},
            {"step_number": 4, "action": "navigate", "target": "https://techcrunch.com", "description": "Open TechCrunch"},
            {"step_number": 5, "action": "type", "target": "Search input", "value": "artificial intelligence", "description": "Search TechCrunch"},
            {"step_number": 6, "action": "extract", "target": "Extract article titles, authors, and summaries", "description": "Extract TechCrunch articles"},
        ]),
    },
]

# ── Demo workflows with pre-built run history ──

DEMO_WORKFLOWS = [
    {
        "name": "Morning Price Monitor",
        "description": "Check prices for top-selling electronics on Amazon and eBay every morning at 9 AM",
        "trigger_type": "scheduled",
        "schedule_cron": "0 9 * * *",
        "status": "active",
        "steps_json": json.dumps([
            {"step_number": 1, "action": "navigate", "target": "https://www.amazon.com", "description": "Open Amazon"},
            {"step_number": 2, "action": "type", "target": "Search bar", "value": "Sony WH-1000XM5", "description": "Search for headphones"},
            {"step_number": 3, "action": "extract", "target": "Extract product name, price, rating, reviews from Amazon results", "description": "Extract Amazon pricing data"},
            {"step_number": 4, "action": "navigate", "target": "https://www.ebay.com", "description": "Open eBay"},
            {"step_number": 5, "action": "type", "target": "Search bar", "value": "Sony WH-1000XM5", "description": "Search eBay for same product"},
            {"step_number": 6, "action": "extract", "target": "Extract product name, price, listing details from eBay", "description": "Extract eBay pricing data"},
            {"step_number": 7, "action": "conditional", "target": "Compare prices", "condition": "amazon_price < ebay_price", "description": "Compare prices across platforms"},
        ]),
        "runs": [
            {"status": "completed", "trigger": "scheduled", "days_ago": 0},
            {"status": "completed", "trigger": "scheduled", "days_ago": 1},
            {"status": "failed", "trigger": "scheduled", "days_ago": 2},
            {"status": "completed", "trigger": "scheduled", "days_ago": 3},
            {"status": "completed", "trigger": "scheduled", "days_ago": 4},
            {"status": "completed", "trigger": "manual", "days_ago": 5},
            {"status": "completed", "trigger": "scheduled", "days_ago": 6},
        ],
    },
    {
        "name": "Weekly Social Sentiment Report",
        "description": "Monitor brand mentions on Twitter and Reddit, analyze sentiment, and compile weekly report",
        "trigger_type": "scheduled",
        "schedule_cron": "0 9 * * 1",
        "status": "active",
        "steps_json": json.dumps([
            {"step_number": 1, "action": "navigate", "target": "https://twitter.com/search", "description": "Open Twitter search"},
            {"step_number": 2, "action": "type", "target": "Search input", "value": "FlowPilot AI", "description": "Search for brand mentions"},
            {"step_number": 3, "action": "extract", "target": "Extract recent tweets with engagement metrics and sentiment", "description": "Extract Twitter data"},
            {"step_number": 4, "action": "navigate", "target": "https://reddit.com/search", "description": "Open Reddit"},
            {"step_number": 5, "action": "type", "target": "Search input", "value": "FlowPilot automation", "description": "Search Reddit"},
            {"step_number": 6, "action": "extract", "target": "Extract Reddit posts, scores, and discussion summaries", "description": "Extract Reddit data"},
            {"step_number": 7, "action": "conditional", "target": "Sentiment check", "condition": "negative_ratio > 0.2", "description": "Alert if negative sentiment exceeds 20%"},
        ]),
        "runs": [
            {"status": "completed", "trigger": "scheduled", "days_ago": 0},
            {"status": "completed", "trigger": "scheduled", "days_ago": 7},
            {"status": "completed", "trigger": "manual", "days_ago": 10},
        ],
    },
    {
        "name": "Daily Tech News Digest",
        "description": "Gather top tech headlines from Google News and TechCrunch every morning",
        "trigger_type": "scheduled",
        "schedule_cron": "0 8 * * *",
        "status": "active",
        "steps_json": json.dumps([
            {"step_number": 1, "action": "navigate", "target": "https://news.google.com", "description": "Open Google News"},
            {"step_number": 2, "action": "type", "target": "Search input", "value": "artificial intelligence startups", "description": "Search for AI news"},
            {"step_number": 3, "action": "extract", "target": "Extract top 5 news headlines with sources and timestamps", "description": "Extract Google News headlines"},
            {"step_number": 4, "action": "navigate", "target": "https://techcrunch.com", "description": "Open TechCrunch"},
            {"step_number": 5, "action": "extract", "target": "Extract latest article titles, authors, and summaries from homepage", "description": "Extract TechCrunch articles"},
        ]),
        "runs": [
            {"status": "completed", "trigger": "scheduled", "days_ago": 0},
            {"status": "completed", "trigger": "scheduled", "days_ago": 1},
            {"status": "completed", "trigger": "scheduled", "days_ago": 2},
            {"status": "completed", "trigger": "scheduled", "days_ago": 3},
            {"status": "completed", "trigger": "scheduled", "days_ago": 4},
        ],
    },
]


async def seed_templates():
    async with async_session() as db:
        result = await db.execute(select(WorkflowTemplate))
        existing = result.scalars().all()
        if existing:
            return

        for tmpl in TEMPLATES:
            template = WorkflowTemplate(**tmpl)
            db.add(template)

        await db.commit()


async def seed_demo_workflows(user_id: str = "default-user"):
    """Create demo workflows (no run history) for a new user."""
    async with async_session() as db:
        # Check if this user already has demo workflows
        result = await db.execute(
            select(Workflow).where(Workflow.user_id == user_id, Workflow.name == "Morning Price Monitor")
        )
        if result.scalar_one_or_none():
            return  # Already seeded

        for wf_template in DEMO_WORKFLOWS:
            wf_def = deepcopy(wf_template)
            wf_def.pop("runs", None)

            workflow = Workflow(
                user_id=user_id,
                name=wf_def["name"],
                description=wf_def["description"],
                steps_json=wf_def["steps_json"],
                trigger_type=wf_def["trigger_type"],
                schedule_cron=wf_def.get("schedule_cron"),
                status=wf_def["status"],
            )
            db.add(workflow)

        await db.commit()
