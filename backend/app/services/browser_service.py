"""Real browser automation via Playwright.

Provides a singleton browser manager, smart element finding based on
descriptive targets (e.g. "Search bar", "Submit button"), and structured
page content extraction.
"""

import asyncio
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# ── Singleton browser instance ───────────────────────────────────────────

_browser = None
_playwright_ctx = None


async def get_browser():
    """Get or create a shared headless Chromium browser."""
    global _browser, _playwright_ctx
    if _browser and _browser.is_connected():
        return _browser
    try:
        from playwright.async_api import async_playwright
        _playwright_ctx = await async_playwright().start()
        _browser = await _playwright_ctx.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        logger.info("Playwright Chromium browser launched")
        return _browser
    except Exception as e:
        logger.error(f"Failed to launch Playwright browser: {e}")
        _browser = None
        return None


async def close_browser():
    """Shut down the shared browser."""
    global _browser, _playwright_ctx
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright_ctx:
        await _playwright_ctx.stop()
        _playwright_ctx = None


async def create_page():
    """Create a stealth browser page that passes common bot detection."""
    browser = await get_browser()
    if not browser:
        return None
    context = await browser.new_context(
        viewport={"width": 1280, "height": 720},
        user_agent=(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
        locale="en-US",
        timezone_id="America/New_York",
        ignore_https_errors=True,
        extra_http_headers={
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-CH-UA": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
            "Sec-CH-UA-Mobile": "?0",
            "Sec-CH-UA-Platform": '"Linux"',
        },
    )
    page = await context.new_page()

    # ── Stealth patches — hide automation fingerprints ──
    await page.add_init_script("""
        // Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

        // Realistic plugins array
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                { name: 'Native Client', filename: 'internal-nacl-plugin' },
            ],
        });

        // Realistic languages
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

        // Pass chrome detection
        window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };

        // Fix permissions query
        const origQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (params) =>
            params.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : origQuery(params);

        // Prevent detection via toString
        const origToString = Function.prototype.toString;
        Function.prototype.toString = function() {
            if (this === navigator.permissions.query) return 'function query() { [native code] }';
            return origToString.call(this);
        };
    """)
    logger.info("Stealth browser page created")
    return page


# ── Smart selector strategies ────────────────────────────────────────────

# Maps descriptive keywords → ordered list of CSS / Playwright selectors
_SELECTOR_MAP: list[tuple[re.Pattern, list[str]]] = [
    # Search inputs (textarea first — Google uses textarea now)
    (re.compile(r"search\s*(bar|input|box|field)?", re.I), [
        'textarea[name="q"]',
        'textarea[aria-label*="earch" i]',
        'textarea[role="combobox"]',
        'input[type="search"]',
        'input[name="q"]',
        'input[name="query"]',
        'input[name="search"]',
        '[role="searchbox"]',
        'input[placeholder*="earch" i]',
        "#search-input",
        "#searchbox",
        "form input[type=\"text\"]",
    ]),
    # Submit / send
    (re.compile(r"submit|send\s*(button)?", re.I), [
        'button[type="submit"]',
        'input[type="submit"]',
        "button >> text=Submit",
        "button >> text=Send",
    ]),
    # Username / email field
    (re.compile(r"(user\s*name|email)\s*(input|field)?", re.I), [
        'input[type="email"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[autocomplete="email"]',
        'input[autocomplete="username"]',
        'input[id*="email" i]',
        'input[id*="user" i]',
        'input[placeholder*="email" i]',
    ]),
    # Password field
    (re.compile(r"password\s*(input|field)?", re.I), [
        'input[type="password"]',
        'input[name="password"]',
    ]),
    # Next page / load-more
    (re.compile(r"(next|load\s*more)\s*(page|button)?", re.I), [
        "a >> text=Next",
        "button >> text=Next",
        "button >> text=Load More",
        "button >> text=Show More",
        '[aria-label="Next"]',
        'a[rel="next"]',
        ".pagination a:last-child",
    ]),
    # First result / link
    (re.compile(r"first\s*(search\s*)?(result|link|item|match|profile)", re.I), [
        "#search h3 a",          # Google
        ".g a",                  # Google fallback
        "#rso a",                # Google results container
        ".search-result a",
        "main a",
        "article a",
        ".results a",
        "h3 a",
    ]),
    # Log-in / sign-in button
    (re.compile(r"(log\s*in|sign\s*in)\s*(button)?", re.I), [
        "button >> text=Log in",
        "button >> text=Sign in",
        "a >> text=Log in",
        "a >> text=Sign in",
        'input[type="submit"]',
    ]),
    # Name field
    (re.compile(r"name\s*(field|input)?", re.I), [
        'input[name="name"]',
        'input[autocomplete="name"]',
        'input[id*="name" i]',
        'input[placeholder*="name" i]',
    ]),
    # Message / details textarea
    (re.compile(r"(message|detail|comment|note)\s*(field|input|area)?", re.I), [
        "textarea",
        'textarea[name="message"]',
        'input[name="message"]',
    ]),
]


async def find_element(page, target_description: str, *, timeout: int = 8000):
    """Locate a page element from a descriptive target string.

    Tries pattern-matched selectors first, then falls back to text
    matching and generic role-based finding.
    """
    desc = target_description.strip()
    desc_lower = desc.lower()

    # 1. Pattern-based selectors — only return VISIBLE elements
    for pattern, selectors in _SELECTOR_MAP:
        if pattern.search(desc_lower):
            for sel in selectors:
                try:
                    all_matches = page.locator(sel)
                    count = await all_matches.count()
                    # Check each match for visibility (not just .first)
                    for idx in range(min(count, 5)):
                        loc = all_matches.nth(idx)
                        try:
                            if await loc.is_visible(timeout=1000):
                                return loc
                        except Exception:
                            continue
                except Exception:
                    continue

    # 2. Try quoted text inside the description  e.g. click "Apply Now"
    quoted = re.findall(r'"([^"]+)"', desc)
    for q in quoted:
        try:
            loc = page.get_by_text(q, exact=False).first
            if await loc.count() > 0 and await loc.is_visible():
                return loc
        except Exception:
            continue

    # 3. Try get_by_role for buttons
    if any(w in desc_lower for w in ("button", "btn", "click", "submit", "press")):
        # Extract meaningful text for the button
        btn_text = re.sub(r"\b(button|btn|click|press|the|a|an)\b", "", desc_lower, flags=re.I).strip()
        if btn_text:
            try:
                loc = page.get_by_role("button", name=re.compile(btn_text, re.I)).first
                if await loc.count() > 0:
                    return loc
            except Exception:
                pass
        try:
            loc = page.get_by_role("button").first
            if await loc.count() > 0 and await loc.is_visible():
                return loc
        except Exception:
            pass

    # 4. Try get_by_role for links
    if any(w in desc_lower for w in ("link", "result", "anchor")):
        try:
            loc = page.get_by_role("link").first
            if await loc.count() > 0 and await loc.is_visible():
                return loc
        except Exception:
            pass

    # 5. Try visible input / textarea (for type actions)
    if any(w in desc_lower for w in ("input", "field", "text", "type", "enter")):
        try:
            loc = page.locator("input:visible, textarea:visible").first
            if await loc.count() > 0:
                return loc
        except Exception:
            pass

    # 6. Generic text search — use the longest meaningful word
    meaningful = [w for w in desc.split() if len(w) > 3 and w.lower() not in
                  {"from", "with", "that", "this", "into", "them", "first", "click",
                   "open", "find", "page", "button", "input", "field", "link", "extract"}]
    for word in sorted(meaningful, key=len, reverse=True)[:3]:
        try:
            loc = page.get_by_text(word, exact=False).first
            if await loc.count() > 0 and await loc.is_visible():
                return loc
        except Exception:
            continue

    # 7. Last resort — try any interactable element
    for fallback in ["a:visible", "button:visible", "input:visible"]:
        try:
            loc = page.locator(fallback).first
            if await loc.count() > 0:
                return loc
        except Exception:
            continue

    return None


async def extract_page_content(page, description: str = "") -> dict:
    """Extract structured content from the current page.

    Returns a dict with title, url, visible text elements, and metadata.
    """
    # Guard against crashed pages
    if page.is_closed():
        raise Exception("Page is closed — browser tab crashed")

    try:
        title = await page.title()
    except Exception:
        title = "Unknown"
    url = page.url

    # Extract visible text grouped by semantic tag
    content = await page.evaluate("""() => {
        const items = [];
        const seen = new Set();
        const els = document.querySelectorAll(
            'h1, h2, h3, h4, h5, p, li, td, th, span, a, label, article, section, [role="listitem"]'
        );
        for (const el of els) {
            let text = el.innerText?.trim() || el.textContent?.trim() || '';
            if (text.length < 3 || text.length > 800 || seen.has(text)) continue;
            seen.add(text);
            items.push({
                tag: el.tagName.toLowerCase(),
                text: text.substring(0, 400),
                href: el.href || null,
            });
            if (items.length >= 80) break;
        }
        return items;
    }""")

    # Extract meta tags
    meta = await page.evaluate("""() => {
        const m = {};
        document.querySelectorAll('meta[name], meta[property]').forEach(el => {
            const key = el.getAttribute('name') || el.getAttribute('property');
            if (key) m[key] = (el.getAttribute('content') || '').substring(0, 200);
        });
        return m;
    }""")

    # Try to extract tabular data if present
    tables = await page.evaluate("""() => {
        const tables = [];
        document.querySelectorAll('table').forEach((table, ti) => {
            if (ti > 2) return;
            const rows = [];
            table.querySelectorAll('tr').forEach((tr, ri) => {
                if (ri > 20) return;
                const cells = [];
                tr.querySelectorAll('td, th').forEach(td => {
                    cells.push(td.innerText?.trim().substring(0, 200) || '');
                });
                if (cells.length > 0) rows.push(cells);
            });
            if (rows.length > 0) tables.push(rows);
        });
        return tables;
    }""")

    result = {
        "page_title": title,
        "url": url,
        "items_extracted": len(content),
        "content": content[:50],  # Limit for result storage
        "scraped_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
    }
    if tables:
        result["tables"] = tables[:2]
    if meta:
        result["meta"] = {k: v for k, v in list(meta.items())[:10]}

    return result


async def take_screenshot(page) -> Optional[bytes]:
    """Take a screenshot for debugging. Returns PNG bytes or None."""
    try:
        return await page.screenshot(type="png")
    except Exception:
        return None


# ── CAPTCHA / bot detection handling ─────────────────────────────────────

# Google domains that may show CAPTCHA
_GOOGLE_DOMAINS = {"google.com", "www.google.com", "google.co.uk", "google.ca"}

# DuckDuckGo is a reliable fallback — no CAPTCHA for automated searches
_GOOGLE_TO_DDG = {
    "https://www.google.com": "https://duckduckgo.com",
    "https://google.com": "https://duckduckgo.com",
}


async def is_blocked(page) -> bool:
    """Detect if the current page is showing a CAPTCHA or bot block."""
    try:
        text = await page.evaluate("() => document.body?.innerText?.substring(0, 2000) || ''")
        lower = text.lower()
        signals = [
            "unusual traffic" in lower,
            "are not a robot" in lower,
            "i'm not a robot" in lower,
            "captcha" in lower,
            "blocked" in lower and "your request" in lower,
            "sorry, you have been blocked" in lower,
            "please verify" in lower and "human" in lower,
            "recaptcha" in lower,
        ]
        return any(signals)
    except Exception:
        return False


def get_fallback_url(url: str) -> Optional[str]:
    """If a URL points to Google, return a DuckDuckGo equivalent."""
    if not url:
        return None
    try:
        from urllib.parse import urlparse, parse_qs, urlencode
        parsed = urlparse(url)
        domain = parsed.hostname or ""
        domain = domain.replace("www.", "")
        if domain.startswith("google."):
            # Extract the search query from Google URL
            params = parse_qs(parsed.query)
            query = params.get("q", [""])[0]
            if query:
                return f"https://duckduckgo.com/?q={urlencode({'': query})[1:]}"
            return "https://duckduckgo.com"
    except Exception:
        pass
    return None


async def navigate_with_fallback(page, url: str, *, timeout: int = 30000) -> dict:
    """Navigate to a URL. If bot-blocked, auto-fallback to DuckDuckGo.

    Returns dict with url, status_code, page_title, fallback info.
    """
    import time as _time
    t0 = _time.monotonic()

    # Ensure URL has a scheme
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    response = await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
    try:
        await page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass

    status = response.status if response else 0
    title = await page.title()
    used_fallback = False

    # Check for CAPTCHA / bot block
    if await is_blocked(page):
        fallback = get_fallback_url(url)
        if fallback:
            logger.warning(f"Bot-blocked at {url}, falling back to {fallback}")
            response = await page.goto(fallback, wait_until="domcontentloaded", timeout=timeout)
            try:
                await page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass
            status = response.status if response else 0
            title = await page.title()
            used_fallback = True
        else:
            logger.warning(f"Bot-blocked at {url}, no fallback available")

    elapsed = round((_time.monotonic() - t0) * 1000)
    result = {
        "url": page.url,
        "status_code": status,
        "page_title": title,
        "load_time_ms": elapsed,
        "dom_ready": True,
        "live": True,
    }
    if used_fallback:
        result["fallback"] = True
        result["original_url"] = url
        result["fallback_reason"] = "Bot detection bypassed via DuckDuckGo"
    return result
