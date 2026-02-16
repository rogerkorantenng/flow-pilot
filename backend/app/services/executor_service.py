"""Workflow step executor — real Playwright browser automation with simulation fallback."""

import asyncio
import base64
import json
import logging
import random
import re
import time
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


EXTRACT_SYSTEM = """You are a web data extraction AI. Given raw page content and a description of what to extract,
parse the content and return structured JSON data.

Return ONLY valid JSON. The data should be well-structured with appropriate field names.
Always return an object (not an array at the top level)."""

CONDITIONAL_SYSTEM = """You are a condition evaluator for browser automation. Given a condition expression
and the result data from previous steps, evaluate whether the condition is true or false.

Return ONLY a JSON object with:
- "evaluated_to": true or false
- "reason": brief explanation of the evaluation"""


# ── Browser availability check ────────────────────────────────────────────

_browser_available = None


async def _check_browser():
    """Check if Playwright browser is available (cached)."""
    global _browser_available
    if _browser_available is not None:
        return _browser_available
    try:
        from app.services.browser_service import get_browser
        browser = await get_browser()
        _browser_available = browser is not None
        if _browser_available:
            logger.info("Playwright browser available — using real automation")
        else:
            logger.warning("Playwright browser not available — falling back to simulation")
    except Exception as e:
        logger.warning(f"Browser check failed: {e} — falling back to simulation")
        _browser_available = False
    return _browser_available


# ── Local content structuring (no AI required) ──────────────────────────

_PRICE_RE = re.compile(r"\$[\d,]+\.?\d*")
_RATING_RE = re.compile(r"(\d(?:\.\d)?)\s*(?:out of|/)\s*5|(\d(?:\.\d)?)\s*stars?", re.I)
_REVIEW_COUNT_RE = re.compile(r"([\d,]+)\s*(?:reviews?|ratings?|votes?)", re.I)


def _structure_raw_content(raw: dict, description: str, target: str) -> dict:
    """Transform raw browser-extracted content into structured, human-friendly data.

    Detects content type from URL patterns and page content, then reshapes
    the data to match the frontend's specialized renderers.
    """
    url = raw.get("url", "").lower()
    title = raw.get("page_title", "")
    content = raw.get("content", [])
    tables = raw.get("tables", [])
    desc_lower = (description + " " + target).lower()

    # ── Search results (DuckDuckGo, Google, Bing) ──
    if any(d in url for d in ("duckduckgo.com", "google.com/search", "bing.com/search")):
        return _structure_search_results(content, title, url)

    # ── Product pages (Amazon, eBay, shopping) ──
    if any(d in url for d in ("amazon.", "ebay.", "walmart.", "etsy.")):
        return _structure_product_page(content, tables, title, url)

    # ── News sites ──
    if any(d in url for d in ("news.ycombinator", "techcrunch", "bbc.com", "cnn.com",
                                "reuters", "reddit.com")):
        return _structure_news_page(content, title, url)

    # ── Reddit ──
    if "reddit.com" in url:
        return _structure_reddit_page(content, title, url)

    # ── LinkedIn ──
    if "linkedin.com" in url:
        return _structure_linkedin_page(content, title, url)

    # ── Based on extraction description keywords ──
    if any(w in desc_lower for w in ("product", "price", "cost", "buy")):
        return _structure_product_page(content, tables, title, url)
    if any(w in desc_lower for w in ("article", "headline", "news", "story")):
        return _structure_news_page(content, title, url)
    if any(w in desc_lower for w in ("search result", "results", "snippet")):
        return _structure_search_results(content, title, url)
    if any(w in desc_lower for w in ("profile", "person", "lead", "contact")):
        return _structure_linkedin_page(content, title, url)

    # ── Generic: clean text extraction ──
    return _structure_generic_page(content, tables, title, url)


def _structure_search_results(content: list, title: str, url: str) -> dict:
    """Structure search engine results."""
    results = []
    i = 0
    while i < len(content):
        item = content[i]
        text = item.get("text", "")
        href = item.get("href", "")
        tag = item.get("tag", "")

        # Search results typically have a heading with a link
        if href and tag in ("a", "h3", "h2") and len(text) > 10:
            snippet = ""
            # Look ahead for snippet text
            for j in range(i + 1, min(i + 4, len(content))):
                next_item = content[j]
                next_tag = next_item.get("tag", "")
                next_text = next_item.get("text", "")
                if next_tag in ("p", "span", "li") and len(next_text) > 20 and not next_item.get("href"):
                    snippet = next_text[:200]
                    break

            results.append({
                "title": text[:120],
                "url": href,
                "snippet": snippet or text[:200],
            })
            if len(results) >= 10:
                break
        i += 1

    if not results:
        # Fallback: treat all link items as results
        for item in content:
            if item.get("href") and len(item.get("text", "")) > 10:
                results.append({
                    "title": item["text"][:120],
                    "url": item["href"],
                    "snippet": "",
                })
                if len(results) >= 10:
                    break

    return {
        "results": results,
        "total_results": f"{len(results)}+",
        "search_time": "live",
        "page_title": title,
    }


def _structure_product_page(content: list, tables: list, title: str, url: str) -> dict:
    """Structure product/shopping page data."""
    products = []
    current_product: dict = {}

    for item in content:
        text = item.get("text", "")
        tag = item.get("tag", "")

        # Detect product name (headings or links with reasonable length)
        if tag in ("h1", "h2", "h3", "a") and 10 < len(text) < 200 and not _PRICE_RE.search(text):
            if current_product.get("name"):
                products.append(current_product)
                if len(products) >= 10:
                    break
            current_product = {"name": text[:120]}
            continue

        # Detect price
        price_match = _PRICE_RE.search(text)
        if price_match and current_product:
            if "price" not in current_product:
                current_product["price"] = price_match.group()

        # Detect rating
        rating_match = _RATING_RE.search(text)
        if rating_match and current_product:
            current_product["rating"] = rating_match.group(1) or rating_match.group(2)

        # Detect review count
        review_match = _REVIEW_COUNT_RE.search(text)
        if review_match and current_product:
            current_product["reviews"] = review_match.group(1)

    if current_product.get("name"):
        products.append(current_product)

    # If we couldn't parse individual products, make a summary
    if not products:
        # Extract any prices and names from all content
        all_text = " ".join(item.get("text", "") for item in content)
        prices = _PRICE_RE.findall(all_text)
        headings = [item["text"] for item in content if item.get("tag") in ("h1", "h2", "h3")]

        if headings or prices:
            product = {"name": headings[0] if headings else title}
            if prices:
                product["price"] = prices[0]
            products.append(product)

    return {
        "products": products[:10],
        "total_found": len(products),
        "page_title": title,
        "source": url.split("//")[1].split("/")[0] if "//" in url else url,
    }


def _structure_news_page(content: list, title: str, url: str) -> dict:
    """Structure news/article page data."""
    articles = []
    domain = url.split("//")[1].split("/")[0] if "//" in url else url

    for item in content:
        text = item.get("text", "")
        tag = item.get("tag", "")
        href = item.get("href", "")

        # Headlines are typically h2/h3 with links, or standalone links with enough text
        if tag in ("h1", "h2", "h3", "a") and len(text) > 15 and len(text) < 300:
            articles.append({
                "title": text[:200],
                "source": domain,
                "url": href or "",
            })
            if len(articles) >= 15:
                break

    return {
        "articles": articles[:15],
        "total_results": len(articles),
        "page_title": title,
    }


def _structure_reddit_page(content: list, title: str, url: str) -> dict:
    """Structure Reddit page data."""
    posts = []
    for item in content:
        text = item.get("text", "")
        tag = item.get("tag", "")
        href = item.get("href", "")

        if tag in ("h3", "h2", "a") and len(text) > 15 and len(text) < 300:
            post = {
                "title": text[:200],
                "subreddit": "r/all",
                "score": 0,
                "comments": 0,
            }
            # Try to extract subreddit from href
            if href and "/r/" in href:
                parts = href.split("/r/")
                if len(parts) > 1:
                    post["subreddit"] = "r/" + parts[1].split("/")[0]
            posts.append(post)
            if len(posts) >= 10:
                break

    return {
        "posts": posts[:10],
        "total_results": len(posts),
        "page_title": title,
    }


def _structure_linkedin_page(content: list, title: str, url: str) -> dict:
    """Structure LinkedIn profile data."""
    profiles = []
    headings = [item["text"] for item in content if item.get("tag") in ("h1", "h2")]
    texts = [item["text"] for item in content if item.get("tag") in ("p", "span", "li")]

    if headings:
        profile = {
            "name": headings[0][:100],
            "title": texts[0][:100] if texts else "Professional",
            "company": texts[1][:100] if len(texts) > 1 else "",
            "location": "",
            "connections": 0,
        }
        # Look for location and connection info
        for t in texts:
            t_lower = t.lower()
            if any(w in t_lower for w in ("location", "area", "city", "country")) or ", " in t:
                if not profile["location"] and len(t) < 60:
                    profile["location"] = t
            if "connection" in t_lower:
                nums = re.findall(r"[\d,]+", t)
                if nums:
                    profile["connections"] = int(nums[0].replace(",", ""))
        profiles.append(profile)

    return {
        "profiles": profiles,
        "page_title": title,
    }


def _structure_generic_page(content: list, tables: list, title: str, url: str) -> dict:
    """Structure any page into a clean, human-readable format."""
    domain = url.split("//")[1].split("/")[0] if "//" in url else url

    # Group content by headings
    sections: list[dict] = []
    current_section: dict = {"heading": title, "items": []}

    for item in content:
        text = item.get("text", "")
        tag = item.get("tag", "")
        href = item.get("href", "")

        if tag in ("h1", "h2", "h3") and len(text) > 3:
            if current_section["items"]:
                sections.append(current_section)
            current_section = {"heading": text[:150], "items": []}
        elif len(text) > 5:
            entry: dict = {"text": text[:300]}
            if href:
                entry["link"] = href
            current_section["items"].append(entry)

    if current_section["items"]:
        sections.append(current_section)

    # Build clean summary items (flat list of the most important text)
    summary_items = []
    for section in sections[:8]:
        for item in section["items"][:5]:
            summary_items.append(item)
        if len(summary_items) >= 20:
            break

    # Build table data if present
    clean_tables = []
    for table in tables[:2]:
        if len(table) > 1:
            clean_tables.append({
                "headers": table[0] if table else [],
                "rows": table[1:10],
            })

    result: dict = {
        "page_title": title,
        "source": domain,
        "sections": sections[:8],
        "items_extracted": len(summary_items),
    }

    if clean_tables:
        result["tables"] = clean_tables

    return result


class ExecutorService:
    _event_queues: dict[str, list[asyncio.Queue]] = {}
    _run_pages: dict[str, object] = {}  # run_id → Playwright Page

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
        page = None
        try:
            # Try to create a real browser page for this run
            if await _check_browser():
                try:
                    from app.services.browser_service import create_page
                    page = await create_page()
                    if page:
                        self._run_pages[run_id] = page
                        logger.info(f"Browser page created for run {run_id}")
                except Exception as e:
                    logger.warning(f"Could not create browser page: {e}")
                    page = None

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
                    "mode": "browser" if page else "simulation",
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
                        await self._execute_step(step, db, run_id, page)

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
                                await self._execute_step(step, db, run_id, page)
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
        finally:
            # Clean up browser page
            if page:
                try:
                    context = page.context
                    await page.close()
                    await context.close()
                    logger.info(f"Browser page closed for run {run_id}")
                except Exception:
                    pass
                self._run_pages.pop(run_id, None)

    async def _execute_step(self, step: WorkflowStep, db: AsyncSession, run_id: str, page=None):
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
            "mode": "browser" if page else "simulation",
        })

        try:
            result_data = None

            # ── Priority 1: Real browser automation ──
            if page:
                try:
                    result_data = await self._browser_step(page, step, db, run_id)
                    logger.info(f"Step {step.step_number} ({step.action}) completed via browser")
                except Exception as e:
                    logger.warning(f"Browser step {step.step_number} failed: {e}")
                    if step.action in ("navigate", "click", "type"):
                        raise
                    result_data = None

            # ── Priority 2: Nova AI for extract/conditional ──
            if result_data is None:
                nova = _get_nova()
                if nova and step.action in ("extract", "conditional"):
                    try:
                        result_data = await self._nova_step(nova, step, run_id, db)
                        logger.info(f"Step {step.step_number} ({step.action}) completed via Nova AI")
                    except Exception as e:
                        logger.warning(f"Nova AI failed for step {step.step_number}: {e}")
                        result_data = None

            # ── Priority 3: Simulation fallback ──
            if result_data is None:
                result_data = await self._simulate_step(step)
                logger.info(f"Step {step.step_number} ({step.action}) completed via simulation fallback")

            # Final screenshot for step record
            screenshot_b64 = None
            if page:
                try:
                    png_bytes = await page.screenshot(type="jpeg", quality=70)
                    screenshot_b64 = base64.b64encode(png_bytes).decode("ascii")
                except Exception as e:
                    logger.debug(f"Screenshot failed for step {step.step_number}: {e}")

            step.status = "completed"
            step.result_data = json.dumps(result_data)
            step.screenshot_b64 = screenshot_b64
            step.completed_at = datetime.now(timezone.utc)
            await db.commit()

            await self._emit(run_id, {
                "type": "step_completed",
                "run_id": run_id,
                "step_id": step.id,
                "step_number": step.step_number,
                "result": result_data,
                "screenshot_b64": screenshot_b64,
            })
        except Exception as e:
            raise StepFailedError(str(e))

    # ══════════════════════════════════════════════════════════════════════
    #  REAL BROWSER AUTOMATION (Playwright)
    # ══════════════════════════════════════════════════════════════════════

    async def _browser_step(self, page, step: WorkflowStep, db: AsyncSession, run_id: str) -> dict:
        """Execute a step using a real Playwright browser page."""
        from app.services.browser_service import (
            find_element, extract_page_content, navigate_with_fallback, is_blocked,
        )

        t0 = time.monotonic()

        if step.action == "navigate":
            target = step.target or "https://www.google.com"
            # Use navigate_with_fallback to handle CAPTCHA automatically
            return await navigate_with_fallback(page, target)

        elif step.action == "click":
            target = step.target or "button"
            element = await find_element(page, target)
            if not element:
                raise Exception(f"ElementNotFound: Could not locate '{target}' on the page")

            await element.scroll_into_view_if_needed(timeout=5000)
            await element.click(timeout=10000)

            try:
                await page.wait_for_load_state("domcontentloaded", timeout=5000)
            except Exception:
                pass

            # Check if click led to a bot block page
            if await is_blocked(page):
                logger.warning("Bot-blocked after click, attempting recovery")
                await page.go_back(timeout=5000)

            elapsed = round((time.monotonic() - t0) * 1000)

            return {
                "element": target,
                "clicked": True,
                "current_url": page.url,
                "response_time_ms": elapsed,
                "live": True,
            }

        elif step.action == "type":
            target = step.target or "input"
            value = step.value or ""
            element = await find_element(page, target)
            if not element:
                raise Exception(f"ElementNotFound: Could not locate input '{target}' on the page")

            await element.click(timeout=5000)
            await element.fill(value, timeout=5000)

            # Press Enter if this looks like a search action
            target_lower = (target + " " + (step.description or "")).lower()
            if any(w in target_lower for w in ("search", "query", "find")):
                await page.wait_for_timeout(500)
                await page.keyboard.press("Enter")
                try:
                    await page.wait_for_load_state("domcontentloaded", timeout=15000)
                except Exception:
                    pass
                try:
                    await page.wait_for_load_state("networkidle", timeout=8000)
                except Exception:
                    pass

                # If search triggered CAPTCHA, fall back to DuckDuckGo
                if await is_blocked(page):
                    logger.warning("Bot-blocked after search, falling back to DuckDuckGo")
                    from urllib.parse import quote_plus
                    ddg_url = f"https://duckduckgo.com/?q={quote_plus(value)}"
                    await page.goto(ddg_url, wait_until="domcontentloaded", timeout=15000)
                    try:
                        await page.wait_for_load_state("networkidle", timeout=8000)
                    except Exception:
                        pass

            elapsed = round((time.monotonic() - t0) * 1000)

            return {
                "element": target,
                "text_entered": value,
                "characters": len(value),
                "current_url": page.url,
                "response_time_ms": elapsed,
                "live": True,
            }

        elif step.action == "extract":
            # Extract real content from the current page
            raw_content = await extract_page_content(page, step.description)

            # If Nova AI is available, let it structure the extracted content
            nova = _get_nova()
            if nova and not nova._is_throttled():
                try:
                    structured = await self._nova_extract_from_content(
                        nova, raw_content, step.description, step.target,
                    )
                    structured["live"] = True
                    structured["source_url"] = raw_content.get("url", "")
                    return structured
                except Exception as e:
                    logger.warning(f"Nova AI content structuring failed: {e}")

            # Local content structuring (no AI needed)
            structured = _structure_raw_content(raw_content, step.description, step.target)
            structured["live"] = True
            structured["source_url"] = raw_content.get("url", "")
            return structured

        elif step.action == "wait":
            wait_ms = int(float(step.value or "2") * 1000)
            await page.wait_for_timeout(wait_ms)
            # Also check if the page is ready
            try:
                await page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass

            return {
                "waited_ms": wait_ms,
                "page_ready": True,
                "current_url": page.url,
                "live": True,
            }

        elif step.action == "conditional":
            # Conditional steps are logic-based, not browser-based
            # Get previous step's result for evaluation
            result = await db.execute(
                select(WorkflowStep)
                .where(WorkflowStep.run_id == run_id)
                .where(WorkflowStep.status == "completed")
                .order_by(WorkflowStep.step_number.desc())
            )
            prev_step = result.scalars().first()
            prev_data = {}
            if prev_step and prev_step.result_data:
                try:
                    prev_data = json.loads(prev_step.result_data)
                except Exception:
                    pass

            condition = step.condition or step.target or "true"

            # Try Nova AI for intelligent evaluation
            nova = _get_nova()
            if nova and not nova._is_throttled():
                try:
                    return await self._nova_conditional(nova, condition, prev_data)
                except Exception:
                    pass

            # Simple rule-based evaluation
            evaluated = self._evaluate_condition(condition, prev_data)
            return {
                "expression": condition,
                "evaluated_to": evaluated,
                "branch_taken": "continue" if evaluated else "skip_next",
                "live": True,
            }

        raise ValueError(f"Unknown action: {step.action}")

    async def _nova_extract_from_content(self, nova, raw_content: dict, description: str, target: str) -> dict:
        """Use Nova AI to structure raw page content based on the extraction description."""
        # Build a text summary from the raw content
        text_parts = []
        for item in raw_content.get("content", [])[:30]:
            text = item.get("text", "")
            href = item.get("href", "")
            if href:
                text_parts.append(f"[{text}]({href})")
            else:
                text_parts.append(text)

        page_text = "\n".join(text_parts)
        if raw_content.get("tables"):
            for table in raw_content["tables"][:1]:
                for row in table[:10]:
                    page_text += "\n| " + " | ".join(str(c) for c in row) + " |"

        prompt = f"""Page: {raw_content.get('page_title', '')} ({raw_content.get('url', '')})

Page content:
{page_text[:3000]}

Extraction task: {description}
Target: {target}

Extract the requested data from the page content above. Return ONLY valid JSON."""

        raw = await asyncio.to_thread(nova._invoke_text, prompt, EXTRACT_SYSTEM, 2048)
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        return json.loads(text)

    async def _nova_conditional(self, nova, condition: str, prev_data: dict) -> dict:
        """Use Nova AI to evaluate a condition against previous step data."""
        prompt = f"""Condition to evaluate: {condition}

Previous step result data:
{json.dumps(prev_data)[:500]}

Evaluate this condition based on the data. Return JSON with "evaluated_to" (boolean) and "reason" (string)."""

        raw = await asyncio.to_thread(nova._invoke_text, prompt, CONDITIONAL_SYSTEM, 256)
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        result = json.loads(text)
        return {
            "expression": condition,
            "evaluated_to": bool(result.get("evaluated_to", True)),
            "branch_taken": "continue" if result.get("evaluated_to", True) else "skip_next",
            "reason": result.get("reason", "Evaluated by Nova AI"),
            "ai_powered": True,
            "live": True,
        }

    @staticmethod
    def _evaluate_condition(condition: str, prev_data: dict) -> bool:
        """Simple rule-based condition evaluation."""
        cond_lower = condition.lower()
        # If previous data has items, consider the condition true
        if any(k in prev_data for k in ("content", "items_extracted", "products", "articles",
                                         "profiles", "results", "posts", "tables")):
            # Check for comparison patterns
            if "<" in condition or ">" in condition:
                # Try to extract numbers and compare
                numbers = re.findall(r"\d+", condition)
                if len(numbers) >= 2:
                    return int(numbers[0]) > int(numbers[1])
            # Default: data exists → condition true
            return True
        # Check for keywords that suggest data quality
        if any(w in cond_lower for w in ("valid", "exists", "found", "quality", "success")):
            return bool(prev_data)
        return True

    # ══════════════════════════════════════════════════════════════════════
    #  NOVA AI STEP (for when browser is not available)
    # ══════════════════════════════════════════════════════════════════════

    async def _nova_step(self, nova, step: WorkflowStep, run_id: str, db: AsyncSession) -> dict:
        """Use Nova AI to generate step results (no browser)."""
        if step.action == "extract":
            result = await db.execute(
                select(WorkflowStep)
                .where(WorkflowStep.run_id == run_id)
                .where(WorkflowStep.status == "completed")
                .order_by(WorkflowStep.step_number)
            )
            prev_steps = result.scalars().all()
            context_parts = []
            for ps in prev_steps[-3:]:
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
            return await self._nova_conditional(nova, condition,
                                                 json.loads(prev_data) if prev_data else {})

        raise ValueError(f"Nova AI not supported for action: {step.action}")

    # ══════════════════════════════════════════════════════════════════════
    #  SIMULATION FALLBACK (when browser + Nova AI both unavailable)
    # ══════════════════════════════════════════════════════════════════════

    async def _simulate_step(self, step: WorkflowStep) -> dict:
        """Fallback simulation when browser is not available."""
        delays = {
            "navigate": (1.0, 2.5),
            "click": (0.4, 1.2),
            "type": (0.5, 1.0),
            "extract": (1.5, 3.0),
            "wait": None,
            "conditional": (0.2, 0.5),
        }

        delay_range = delays.get(step.action)
        if delay_range is None:
            delay = float(step.value or "1")
        else:
            delay = random.uniform(*delay_range)
        await asyncio.sleep(delay)

        if step.action == "navigate":
            target = step.target or "https://example.com"
            return {
                "url": target,
                "status_code": 200,
                "page_title": f"Page at {target.split('//')[1].split('/')[0] if '//' in target else target}",
                "load_time_ms": round(random.uniform(200, 2000)),
                "dom_ready": True,
                "simulated": True,
            }

        elif step.action == "click":
            return {
                "element": step.target or "button",
                "clicked": True,
                "response_time_ms": round(random.uniform(50, 300)),
                "simulated": True,
            }

        elif step.action == "type":
            value = step.value or ""
            return {
                "element": step.target or "input",
                "text_entered": value,
                "characters": len(value),
                "simulated": True,
            }

        elif step.action == "extract":
            return {
                "note": "Simulated extraction — install Playwright for real data",
                "page_title": "Simulated Page",
                "items_extracted": random.randint(3, 15),
                "content": [
                    {"tag": "h1", "text": f"Results for: {step.description[:50]}"},
                    {"tag": "p", "text": "This is simulated content. Real browser automation will extract actual page data."},
                ],
                "simulated": True,
            }

        elif step.action == "wait":
            wait_time = float(step.value or "2")
            return {
                "waited_ms": int(wait_time * 1000),
                "page_ready": True,
                "simulated": True,
            }

        elif step.action == "conditional":
            evaluated = True
            return {
                "expression": step.condition or step.target or "true",
                "evaluated_to": evaluated,
                "branch_taken": "continue" if evaluated else "skip_next",
                "simulated": True,
            }

        return {"status": "completed", "action": step.action, "simulated": True}

    # ══════════════════════════════════════════════════════════════════════
    #  SELF-HEALING
    # ══════════════════════════════════════════════════════════════════════

    async def _try_self_heal(self, step: WorkflowStep, error_msg: str, run_id: str, db: AsyncSession) -> bool:
        """Try to auto-fix a failed step using AI. Returns True if healed."""
        nova = _get_nova()
        if not nova:
            return False
        try:
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

            page = self._run_pages.get(run_id)
            await self._execute_step(step, db, run_id, page)

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
