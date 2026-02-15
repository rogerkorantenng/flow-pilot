import asyncio
import json
import logging
import re

logger = logging.getLogger(__name__)

PLANNER_SYSTEM = """You are a workflow planner AI. Given a natural language description of a business workflow,
decompose it into a sequence of browser automation steps.

Return ONLY a valid JSON array of step objects. Each step must have:
- step_number: integer starting from 1
- action: one of "navigate", "click", "type", "extract", "wait", "conditional"
- target: URL for navigate, element description for click/type, data description for extract
- value: (optional) text to type, wait duration in seconds, or condition expression
- description: human-readable description of what this step does
- condition: (optional) for conditional steps, the condition to evaluate

Be specific about targets and actions. Use realistic URLs and selectors.
Always start with a "navigate" step to open the first relevant website."""

# Keyword-based plan templates for simulation mode
PLAN_TEMPLATES = {
    "price": {
        "keywords": ["price", "competitor", "compare", "cost", "shop", "buy", "product", "amazon", "ebay", "store"],
        "steps": [
            {"step_number": 1, "action": "navigate", "target": "https://www.amazon.com", "description": "Open Amazon"},
            {"step_number": 2, "action": "type", "target": "Search bar", "value": "{query}", "description": "Search for the product"},
            {"step_number": 3, "action": "click", "target": "First search result", "description": "Click on the top result"},
            {"step_number": 4, "action": "extract", "target": "Extract product name, price, rating, and review count from Amazon", "description": "Extract Amazon pricing data"},
            {"step_number": 5, "action": "navigate", "target": "https://www.ebay.com", "description": "Open eBay"},
            {"step_number": 6, "action": "type", "target": "Search bar", "value": "{query}", "description": "Search for the same product on eBay"},
            {"step_number": 7, "action": "extract", "target": "Extract product name, price, and listing details from eBay", "description": "Extract eBay pricing data"},
            {"step_number": 8, "action": "conditional", "target": "Compare prices", "condition": "amazon_price < ebay_price", "description": "Compare prices across platforms"},
        ],
    },
    "email": {
        "keywords": ["email", "inbox", "mail", "message", "gmail"],
        "steps": [
            {"step_number": 1, "action": "navigate", "target": "https://mail.google.com", "description": "Open Gmail inbox"},
            {"step_number": 2, "action": "click", "target": "Search mail input", "description": "Focus on search bar"},
            {"step_number": 3, "action": "type", "target": "Search input", "value": "{query}", "description": "Search for relevant emails"},
            {"step_number": 4, "action": "extract", "target": "Extract email subjects, senders, dates, and preview text", "description": "Extract matching email data"},
            {"step_number": 5, "action": "click", "target": "First matching email", "description": "Open the most recent match"},
            {"step_number": 6, "action": "extract", "target": "Extract email body content, attachments, and sender details", "description": "Extract full email contents"},
        ],
    },
    "news": {
        "keywords": ["news", "headline", "article", "digest", "report", "story", "hacker news"],
        "steps": [
            {"step_number": 1, "action": "navigate", "target": "https://news.google.com", "description": "Open Google News"},
            {"step_number": 2, "action": "type", "target": "Search input", "value": "{query}", "description": "Search for the topic"},
            {"step_number": 3, "action": "extract", "target": "Extract top 5 news headlines with sources, authors, and timestamps", "description": "Extract top news headlines"},
            {"step_number": 4, "action": "navigate", "target": "https://techcrunch.com", "description": "Open TechCrunch"},
            {"step_number": 5, "action": "type", "target": "Search input", "value": "{query}", "description": "Search TechCrunch for the topic"},
            {"step_number": 6, "action": "extract", "target": "Extract article titles, authors, publication dates, and summaries", "description": "Extract TechCrunch articles"},
            {"step_number": 7, "action": "navigate", "target": "https://reddit.com/search", "description": "Open Reddit search"},
            {"step_number": 8, "action": "type", "target": "Search input", "value": "{query}", "description": "Search Reddit discussions"},
            {"step_number": 9, "action": "extract", "target": "Extract top Reddit posts with scores, comment counts, and subreddits", "description": "Extract Reddit discussions"},
        ],
    },
    "social": {
        "keywords": ["twitter", "instagram", "social", "monitor", "mention", "brand", "sentiment", "hashtag"],
        "steps": [
            {"step_number": 1, "action": "navigate", "target": "https://twitter.com/search", "description": "Open Twitter/X search"},
            {"step_number": 2, "action": "type", "target": "Search input", "value": "{query}", "description": "Search for mentions"},
            {"step_number": 3, "action": "extract", "target": "Extract recent tweets with likes, retweets, replies, and sentiment", "description": "Extract Twitter mentions and engagement"},
            {"step_number": 4, "action": "navigate", "target": "https://reddit.com/search", "description": "Open Reddit search"},
            {"step_number": 5, "action": "type", "target": "Search input", "value": "{query}", "description": "Search Reddit for discussions"},
            {"step_number": 6, "action": "extract", "target": "Extract top Reddit posts, scores, comments, and subreddits", "description": "Extract Reddit mentions"},
            {"step_number": 7, "action": "conditional", "target": "Analyze sentiment", "condition": "negative_mentions > 5", "description": "Check if negative sentiment threshold exceeded"},
        ],
    },
    "scrape": {
        "keywords": ["scrape", "extract", "data", "collect", "website", "visit", "page"],
        "steps": [
            {"step_number": 1, "action": "navigate", "target": "{url}", "description": "Open the target website"},
            {"step_number": 2, "action": "wait", "target": "Page load", "value": "2", "description": "Wait for dynamic content to load"},
            {"step_number": 3, "action": "extract", "target": "Extract main content — titles, text, images, and metadata", "description": "Extract page content"},
            {"step_number": 4, "action": "click", "target": "Next page or Load More button", "description": "Navigate to next page"},
            {"step_number": 5, "action": "extract", "target": "Extract additional content from subsequent pages", "description": "Extract more data"},
        ],
    },
    "form": {
        "keywords": ["fill", "submit", "form", "apply", "register", "sign up"],
        "steps": [
            {"step_number": 1, "action": "navigate", "target": "{url}", "description": "Open the form page"},
            {"step_number": 2, "action": "type", "target": "Name field", "value": "{{name}}", "description": "Fill in name"},
            {"step_number": 3, "action": "type", "target": "Email field", "value": "{{email}}", "description": "Fill in email address"},
            {"step_number": 4, "action": "type", "target": "Message/Details field", "value": "{{message}}", "description": "Fill in details"},
            {"step_number": 5, "action": "click", "target": "Submit button", "description": "Submit the form"},
            {"step_number": 6, "action": "extract", "target": "Extract confirmation message and reference number", "description": "Capture confirmation"},
        ],
    },
    "login": {
        "keywords": ["log in", "login", "sign in", "authenticate", "credentials"],
        "steps": [
            {"step_number": 1, "action": "navigate", "target": "{url}", "description": "Open login page"},
            {"step_number": 2, "action": "type", "target": "Username/email input", "value": "{{username}}", "description": "Enter username"},
            {"step_number": 3, "action": "type", "target": "Password input", "value": "{{password}}", "description": "Enter password"},
            {"step_number": 4, "action": "click", "target": "Login/Sign In button", "description": "Click login"},
            {"step_number": 5, "action": "wait", "target": "Dashboard", "value": "2", "description": "Wait for redirect to dashboard"},
            {"step_number": 6, "action": "extract", "target": "Extract dashboard data, account info, and metrics", "description": "Verify login and extract data"},
        ],
    },
    "lead": {
        "keywords": ["lead", "linkedin", "prospect", "research person", "profile", "contact"],
        "steps": [
            {"step_number": 1, "action": "navigate", "target": "https://linkedin.com", "description": "Open LinkedIn"},
            {"step_number": 2, "action": "type", "target": "Search bar", "value": "{query}", "description": "Search for the person"},
            {"step_number": 3, "action": "click", "target": "First matching profile result", "description": "Open profile"},
            {"step_number": 4, "action": "extract", "target": "Extract name, title, company, location, connections from LinkedIn profile", "description": "Extract profile data"},
            {"step_number": 5, "action": "navigate", "target": "https://www.google.com", "description": "Open Google"},
            {"step_number": 6, "action": "type", "target": "Search input", "value": "{query} company", "description": "Search for company info"},
            {"step_number": 7, "action": "extract", "target": "Extract company size, industry, funding, headquarters from search results", "description": "Extract company details"},
        ],
    },
    "research": {
        "keywords": ["find", "look up", "search", "learn", "info", "research", "google"],
        "steps": [
            {"step_number": 1, "action": "navigate", "target": "https://www.google.com", "description": "Open Google search"},
            {"step_number": 2, "action": "type", "target": "Search input", "value": "{query}", "description": "Search for the topic"},
            {"step_number": 3, "action": "extract", "target": "Extract top 5 search results with titles, URLs, and snippets", "description": "Extract search results"},
            {"step_number": 4, "action": "click", "target": "Most relevant search result", "description": "Open the top result"},
            {"step_number": 5, "action": "extract", "target": "Extract article content, key facts, statistics, and dates", "description": "Extract detailed information"},
            {"step_number": 6, "action": "navigate", "target": "https://en.wikipedia.org", "description": "Open Wikipedia"},
            {"step_number": 7, "action": "type", "target": "Search input", "value": "{query}", "description": "Search Wikipedia"},
            {"step_number": 8, "action": "extract", "target": "Extract Wikipedia summary, key dates, and references", "description": "Extract Wikipedia summary"},
        ],
    },
}

DEFAULT_STEPS = [
    {"step_number": 1, "action": "navigate", "target": "https://www.google.com", "description": "Open Google search"},
    {"step_number": 2, "action": "type", "target": "Search input", "value": "{query}", "description": "Search for relevant information"},
    {"step_number": 3, "action": "extract", "target": "Extract search results, titles, URLs, and snippets", "description": "Extract search results"},
    {"step_number": 4, "action": "click", "target": "Most relevant result link", "description": "Open the best matching result"},
    {"step_number": 5, "action": "extract", "target": "Extract page content, key information, and data points", "description": "Extract detailed data"},
    {"step_number": 6, "action": "conditional", "target": "Validate extracted data", "condition": "data_quality > threshold", "description": "Check if extracted data meets quality threshold"},
]


def _extract_urls(text: str) -> list[str]:
    """Find URLs in the user's description."""
    return re.findall(r'https?://[^\s,\'"]+', text)


def _extract_query(description: str, matched_keyword: str) -> str:
    """Extract the most relevant search query from the user's description."""
    # Remove common filler words to get the core topic
    filler = {"check", "find", "get", "search", "look", "monitor", "track", "every", "morning",
              "daily", "weekly", "and", "the", "for", "on", "from", "to", "all", "top", "best",
              "new", "latest", "recent", "my", "our", "about", "with", "a", "an", "is", "are",
              "was", "were", "will", "can", "should", "do", "does", "i", "want", "need", "please",
              "extract", "scrape", "collect", "gather", "compile", "save", "into", "in"}
    words = description.split()
    meaningful = [w for w in words if w.lower().strip(".,!?") not in filler and len(w) > 2]
    if len(meaningful) > 6:
        meaningful = meaningful[:6]
    return " ".join(meaningful) if meaningful else description[:50]


class PlannerService:
    def __init__(self):
        self._nova = None

    def _get_nova(self):
        if self._nova is None:
            try:
                from app.services.nova_service import NovaService
                self._nova = NovaService()
                self._nova.client.meta.region_name  # Verify connection
                logger.info("Nova AI connected for planner")
            except Exception as e:
                logger.warning(f"Nova AI not available for planner: {e}")
                self._nova = None
        return self._nova

    async def plan(self, description: str) -> list[dict]:
        nova = self._get_nova()
        if nova and not nova._is_throttled():
            try:
                prompt = f"Decompose this workflow into browser automation steps:\n\n{description}\n\nReturn ONLY the JSON array, no other text."
                raw = await asyncio.to_thread(nova._invoke_text, prompt, PLANNER_SYSTEM)
                text = raw.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                    if text.endswith("```"):
                        text = text[:-3]
                    text = text.strip()
                steps = json.loads(text)
                if isinstance(steps, list) and len(steps) > 0:
                    logger.info(f"Nova AI planned {len(steps)} steps for: {description[:50]}")
                    return steps
            except Exception as e:
                logger.warning(f"Nova planning failed, falling back to simulation: {e}")

        logger.info("Using simulation planner")
        return self._simulate_plan(description)

    def _simulate_plan(self, description: str) -> list[dict]:
        desc_lower = description.lower()

        # Extract any URLs the user provided
        user_urls = _extract_urls(description)

        # Find best matching template by counting keyword matches
        best_match = None
        best_score = 0
        best_key = ""

        for key, template in PLAN_TEMPLATES.items():
            score = sum(1 for kw in template["keywords"] if kw in desc_lower)
            if score > best_score:
                best_score = score
                best_match = template["steps"]
                best_key = key

        plan = json.loads(json.dumps(best_match or DEFAULT_STEPS))

        # Extract the search query from the description
        query = _extract_query(description, best_key)

        # Replace placeholders
        for step in plan:
            # Replace {query} with actual search terms
            if step.get("value") == "{query}":
                step["value"] = query

            # Replace {url} with user-provided URL or sensible default
            if step.get("target") == "{url}":
                if user_urls:
                    step["target"] = user_urls[0]
                else:
                    step["target"] = f"https://www.google.com/search?q={query.replace(' ', '+')}"

        # If user provided URLs, ensure the first navigate goes to their URL
        if user_urls and plan and plan[0]["action"] == "navigate":
            if user_urls[0] not in plan[0]["target"]:
                # Prepend a navigate to their URL
                for s in plan:
                    s["step_number"] += 1
                plan.insert(0, {
                    "step_number": 1,
                    "action": "navigate",
                    "target": user_urls[0],
                    "description": f"Open {user_urls[0].split('//')[1].split('/')[0] if '//' in user_urls[0] else user_urls[0]}",
                })

        return plan
