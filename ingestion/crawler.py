"""Shelter website crawler — ShelterLuv-aware + generic Crawl4AI fallback.

For ShelterLuv-powered shelters (Vue.js SPAs), we use Playwright to:
  1. Load the embed page and wait for JS to render the pet grid.
  2. Extract individual pet links (/embed/animal/XXXX).
  3. Visit each pet detail page (also JS-rendered) and parse structured data.

For non-ShelterLuv shelters, falls back to the original Crawl4AI BFS crawl.

Requirements:
    pip install playwright
    playwright install chromium
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin, unquote

import httpx
import structlog
from bs4 import BeautifulSoup

from config.settings import get_settings

logger = structlog.get_logger(__name__)

SHELTERLUV_BASE = "https://www.shelterluv.com"


@dataclass
class CrawledPage:
    """A single page result from the crawler."""
    url: str
    markdown: str
    title: str = ""
    depth: int = 0


@dataclass
class ShelterLuvPetRaw:
    """Raw data parsed directly from ShelterLuv HTML — no LLM needed."""
    name: str = ""
    animal_id: str = ""
    breed: str = ""
    sex: str = ""
    weight: str = ""
    age: str = ""
    location: str = ""
    adoption_fee: str = ""
    intake_date: str = ""
    image_url: str = ""
    detail_url: str = ""
    description: str = ""
    color: str = ""
    spayed_neutered: str = ""


# ══════════════════════════════════════════════════════════════════════════════
# PLAYWRIGHT HELPERS — for JS-rendered ShelterLuv pages
# ══════════════════════════════════════════════════════════════════════════════

async def _get_rendered_html(url: str, wait_selector: str | None = None,
                              wait_seconds: float = 5.0) -> str:
    """Use Playwright to load a JS-rendered page and return the full HTML.

    Args:
        url: Page to load.
        wait_selector: CSS selector to wait for before capturing HTML.
        wait_seconds: Extra time (seconds) to let lazy content load.
    """
    from playwright.async_api import async_playwright

    html = ""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 2000},
        )
        page = await context.new_page()

        try:
            logger.info("Playwright: loading page", url=url)
            await page.goto(url, wait_until="networkidle", timeout=30000)

            # Wait for a specific element if provided
            if wait_selector:
                try:
                    await page.wait_for_selector(wait_selector, timeout=15000)
                    logger.info("Playwright: found selector", selector=wait_selector)
                except Exception:
                    logger.warning("Playwright: selector not found, continuing",
                                  selector=wait_selector)

            # Extra wait for lazy-loaded images / Vue reactivity
            if wait_seconds > 0:
                await asyncio.sleep(wait_seconds)

            # Scroll down to trigger any lazy loading
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(2)

            html = await page.content()
            logger.info("Playwright: captured HTML", length=len(html))

        except Exception as e:
            logger.error("Playwright: page load failed", url=url, error=str(e))
        finally:
            await browser.close()

    return html


# ══════════════════════════════════════════════════════════════════════════════
# SHELTERLUV CRAWLER
# ══════════════════════════════════════════════════════════════════════════════

async def crawl_shelterluv(
    embed_url: str,
    species: str | None = None,
    delay_seconds: float | None = None,
) -> list[CrawledPage]:
    """Crawl a ShelterLuv embed to get all pet listings.

    Uses Playwright to render the Vue.js app before parsing.

    Args:
        embed_url: The ShelterLuv embed URL, e.g.
            https://www.shelterluv.com/embed/280?species=Dog&embedded=1&...
            OR the shelter page URL that contains the iframe.
        species: Optional species filter (Dog, Cat, etc.)
        delay_seconds: Polite delay between requests.

    Returns:
        List of CrawledPage objects, one per pet, with structured markdown.
    """
    settings = get_settings()
    delay = delay_seconds or settings.crawl_delay_seconds

    # Clean up HTML entities in URL
    clean_url = embed_url.replace("&amp;", "&")

    # If user passed the shelter page (not the embed URL), try to find the iframe
    resolved_embed_url = await _resolve_embed_url(clean_url)
    if not resolved_embed_url:
        logger.error("Could not find ShelterLuv embed URL", input_url=clean_url)
        return []

    logger.info("Crawling ShelterLuv embed", url=resolved_embed_url)

    # ── Step 1: Load listing page with Playwright, extract pet links ──────
    pet_links = await _fetch_pet_links_playwright(resolved_embed_url)
    if not pet_links:
        logger.warning("No pet links found on embed page", url=resolved_embed_url)
        return []

    logger.info("Found pet links", count=len(pet_links))

    # ── Step 2: Visit each pet detail page with Playwright ────────────────
    pages: list[CrawledPage] = []

    for i, link_info in enumerate(pet_links):
        pet_url = link_info["url"]
        pet_name = link_info.get("name", "")
        pet_image = link_info.get("image", "")

        try:
            logger.info("Fetching pet detail", index=i + 1, total=len(pet_links),
                        name=pet_name, url=pet_url)

            # Use Playwright — pet detail pages are also Vue.js rendered
            html = await _get_rendered_html(
                pet_url,
                wait_selector="h1",  # Wait for the pet name heading
                wait_seconds=3.0,
            )

            if not html or len(html) < 200:
                logger.warning("Empty or tiny HTML for pet detail", url=pet_url)
                continue

            # Parse the rendered HTML
            raw_pet = _parse_pet_detail_page(html, pet_url)

            # Fill in data from the listing page if missing from detail
            if not raw_pet.name and pet_name:
                raw_pet.name = pet_name
            if not raw_pet.image_url and pet_image:
                raw_pet.image_url = pet_image
            raw_pet.detail_url = pet_url

            # Convert to structured markdown
            markdown = _raw_pet_to_markdown(raw_pet)

            pages.append(CrawledPage(
                url=pet_url,
                markdown=markdown,
                title=raw_pet.name or pet_name,
                depth=1,
            ))

            logger.info("Parsed pet", name=raw_pet.name, breed=raw_pet.breed,
                        age=raw_pet.age, fee=raw_pet.adoption_fee)

        except Exception as e:
            logger.warning("Failed to fetch pet detail", url=pet_url, error=str(e))

        # Polite delay between requests
        if delay > 0 and i < len(pet_links) - 1:
            await asyncio.sleep(delay)

    logger.info("ShelterLuv crawl complete", pages_collected=len(pages))
    return pages


async def _resolve_embed_url(url: str) -> str | None:
    """If the URL is a shelter page, find the ShelterLuv iframe src.
    If it's already a ShelterLuv URL, return it directly."""

    # Already a ShelterLuv embed URL
    if "shelterluv.com/embed" in url:
        return url

    # Try to fetch the page and find the iframe
    # Use Playwright since the shelter page itself might be JS-rendered
    try:
        html = await _get_rendered_html(url, wait_seconds=3.0)
        soup = BeautifulSoup(html, "html.parser")

        for iframe in soup.find_all("iframe"):
            src = iframe.get("src", "")
            cls = " ".join(iframe.get("class", []))

            if "shelterluv" in cls or "shelterluv.com" in src:
                logger.info("Found ShelterLuv iframe", src=src)
                return src

            domain = iframe.get("data-domain", "")
            if "shelterluv.com" in domain and src:
                logger.info("Found ShelterLuv iframe via data-domain", src=src)
                return src

    except Exception as e:
        logger.warning("Failed to resolve embed URL", url=url, error=str(e))

    return None


async def _fetch_pet_links_playwright(embed_url: str) -> list[dict]:
    """Load the ShelterLuv listing page with Playwright and extract pet links.

    Returns list of dicts: [{"url": ..., "name": ..., "image": ...}, ...]
    """
    pets = []

    # The listing page renders a grid of pet cards via Vue.js
    # Wait for the pet card links to appear
    html = await _get_rendered_html(
        embed_url,
        wait_selector="a[href*='/embed/animal/']",
        wait_seconds=5.0,
    )

    if not html:
        logger.error("Playwright returned empty HTML for listing page", url=embed_url)
        return []

    soup = BeautifulSoup(html, "html.parser")

    # Debug: log how much content we got
    all_links = soup.find_all("a", href=True)
    logger.info("Total links found in rendered HTML", count=len(all_links))

    # ShelterLuv pattern: <a href="/embed/animal/CMHS-A-XXXXX">
    #   <img src="..." alt="Name's preview photo">
    #   <div class="text-center ...">Name</div>
    # </a>
    for link in all_links:
        href = link["href"]

        if "/embed/animal/" not in href:
            continue

        # Make absolute URL
        if href.startswith("/"):
            full_url = SHELTERLUV_BASE + href
        elif not href.startswith("http"):
            full_url = urljoin(embed_url, href)
        else:
            full_url = href

        # Extract name
        name = ""
        name_div = link.find("div")
        if name_div:
            name = name_div.get_text(strip=True)

        # Extract preview image
        image = ""
        img_tag = link.find("img")
        if img_tag:
            image = img_tag.get("src", "")
            if not name:
                alt = img_tag.get("alt", "")
                name = re.sub(r"'s preview photo$", "", alt).strip()

        # Deduplicate
        if any(p["url"] == full_url for p in pets):
            continue

        pets.append({
            "url": full_url,
            "name": name,
            "image": image,
        })

    logger.info("Extracted pet links from rendered page", count=len(pets))
    return pets


def _parse_pet_detail_page(html: str, url: str) -> ShelterLuvPetRaw:
    """Parse a rendered ShelterLuv pet detail page into structured data."""
    soup = BeautifulSoup(html, "html.parser")
    pet = ShelterLuvPetRaw(detail_url=url)

    # Name — usually in an <h1>
    h1 = soup.find("h1")
    if h1:
        pet.name = h1.get_text(strip=True)

    # ── Parse labeled field rows ──────────────────────────────────────────
    # ShelterLuv uses flex rows with uppercase label divs and value divs.
    # Strategy: find all divs containing "uppercase" in class (these are labels),
    # then grab the next sibling div as the value.
    label_divs = soup.find_all("div", class_=re.compile(r"uppercase"))

    for label_div in label_divs:
        label_text = label_div.get_text(strip=True).lower()
        if not label_text:
            continue

        # The value is typically the next sibling div
        value_div = label_div.find_next_sibling("div")
        if not value_div:
            # Try parent's children
            parent = label_div.parent
            if parent:
                children = parent.find_all("div", recursive=False)
                for j, child in enumerate(children):
                    if child == label_div and j + 1 < len(children):
                        value_div = children[j + 1]
                        break

        if not value_div:
            continue

        value_text = value_div.get_text(strip=True)
        if not value_text:
            continue

        # Map label to field
        if "animal id" in label_text or label_text == "id":
            pet.animal_id = value_text
        elif "breed" in label_text:
            pet.breed = value_text
        elif "sex" in label_text:
            pet.sex = value_text
        elif "weight" in label_text:
            pet.weight = value_text
        elif label_text == "age" or (label_text.startswith("age") and "intake" not in label_text):
            pet.age = value_text
        elif "location" in label_text:
            pet.location = value_text
        elif "adoption fee" in label_text or "fee" in label_text:
            pet.adoption_fee = value_text
        elif "intake" in label_text:
            pet.intake_date = value_text
        elif "color" in label_text:
            pet.color = value_text
        elif "spay" in label_text or "neuter" in label_text:
            pet.spayed_neutered = value_text

    # ── Images ────────────────────────────────────────────────────────────
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if "shelterluv.com" in src and "profile-pictures" in src:
            pet.image_url = src
            break

    # Fallback: any shelterluv image that isn't a social icon
    if not pet.image_url:
        for img in soup.find_all("img"):
            src = img.get("src", "")
            if "shelterluv" in src and "social" not in src and "/img/" not in src:
                pet.image_url = src
                break

    # ── Description / bio ─────────────────────────────────────────────────
    # Look for substantial text blocks that aren't field labels or buttons
    for div in soup.find_all("div"):
        classes = " ".join(div.get("class", []))
        text = div.get_text(strip=True)

        # Skip small text, labels, and buttons
        if len(text) < 80:
            continue
        if "uppercase" in classes:
            continue
        if "Apply for Adoption" in text:
            continue
        # Skip if this div contains the entire page (too broad)
        if len(text) > 2000:
            continue

        # Check it's not just a container of the field rows we already parsed
        child_labels = div.find_all("div", class_=re.compile(r"uppercase"))
        if len(child_labels) > 2:
            continue

        pet.description = text
        break

    return pet


def _raw_pet_to_markdown(pet: ShelterLuvPetRaw) -> str:
    """Convert raw parsed ShelterLuv data to structured markdown."""

    lines = [f"# {pet.name}"]

    if pet.animal_id:
        lines.append(f"- **Animal ID**: {pet.animal_id}")
    if pet.breed:
        lines.append(f"- **Breed**: {pet.breed}")
    if pet.sex:
        lines.append(f"- **Sex**: {pet.sex}")
    if pet.weight:
        lines.append(f"- **Weight**: {pet.weight}")
    if pet.age:
        lines.append(f"- **Age**: {pet.age}")
    if pet.color:
        lines.append(f"- **Color**: {pet.color}")
    if pet.location:
        lines.append(f"- **Location**: {pet.location}")
    if pet.adoption_fee:
        lines.append(f"- **Adoption Fee**: {pet.adoption_fee}")
    if pet.intake_date:
        lines.append(f"- **Intake Date**: {pet.intake_date}")
    if pet.spayed_neutered:
        lines.append(f"- **Spayed/Neutered**: {pet.spayed_neutered}")
    if pet.image_url:
        lines.append(f"- **Photo**: {pet.image_url}")
    if pet.detail_url:
        lines.append(f"- **Listing URL**: {pet.detail_url}")

    if pet.description:
        lines.append(f"\n## Description\n{pet.description}")

    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
# GENERIC CRAWL4AI FALLBACK
# ══════════════════════════════════════════════════════════════════════════════

async def crawl_shelter_generic(
    shelter_url: str,
    max_depth: int | None = None,
    max_pages: int | None = None,
    delay_seconds: float | None = None,
) -> list[CrawledPage]:
    """Crawl a shelter website using Crawl4AI (non-ShelterLuv sites)."""
    settings = get_settings()
    max_depth = max_depth or settings.crawl_max_depth
    max_pages = max_pages or settings.crawl_max_pages
    delay_seconds = delay_seconds or settings.crawl_delay_seconds

    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

    pages: list[CrawledPage] = []

    pet_url_patterns = re.compile(
        r"(adopt|pet|animal|dog|cat|available|listing|detail|profile)",
        re.IGNORECASE,
    )

    crawl_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=10,
        process_iframes=False,
        remove_overlay_elements=True,
    )

    logger.info("Starting generic crawl", url=shelter_url, max_depth=max_depth)

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(
            url=shelter_url,
            config=crawl_config,
            max_depth=max_depth,
        )

        results = [result] if not isinstance(result, list) else result

        for res in results:
            if not res.success:
                logger.warning("Failed to crawl page", url=res.url, error=res.error_message)
                continue

            if not pet_url_patterns.search(res.url) and res.url.rstrip("/") != shelter_url.rstrip("/"):
                continue

            markdown_content = ""
            if res.markdown:
                markdown_content = getattr(res.markdown, "fit_markdown", res.markdown)

            if len(markdown_content.strip()) < 50:
                continue

            pages.append(CrawledPage(
                url=res.url,
                markdown=markdown_content,
                title=res.metadata.get("title", "") if res.metadata else "",
                depth=getattr(res, "depth", 0),
            ))

    logger.info("Generic crawl complete", pages_collected=len(pages))
    return pages


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT — auto-detects ShelterLuv vs generic
# ══════════════════════════════════════════════════════════════════════════════

async def crawl_shelter(
    shelter_url: str,
    max_depth: int | None = None,
    max_pages: int | None = None,
    delay_seconds: float | None = None,
) -> list[CrawledPage]:
    """Crawl a shelter website — auto-detects ShelterLuv iframes.

    If the page (or URL) contains a ShelterLuv embed, uses the
    ShelterLuv-specific Playwright parser. Otherwise falls back to Crawl4AI.
    """
    # Clean HTML entities
    clean_url = shelter_url.replace("&amp;", "&")

    # Check if this is directly a ShelterLuv URL
    if "shelterluv.com" in clean_url:
        return await crawl_shelterluv(clean_url, delay_seconds=delay_seconds)

    # Check if the page contains a ShelterLuv iframe
    embed_url = await _resolve_embed_url(clean_url)
    if embed_url:
        logger.info("Detected ShelterLuv embed, using specialized crawler")
        return await crawl_shelterluv(embed_url, delay_seconds=delay_seconds)

    # Fallback to generic crawl
    logger.info("No ShelterLuv embed detected, using generic Crawl4AI crawler")
    return await crawl_shelter_generic(
        clean_url, max_depth=max_depth, max_pages=max_pages, delay_seconds=delay_seconds,
    )


def crawl_shelter_sync(
    shelter_url: str,
    max_depth: int | None = None,
    max_pages: int | None = None,
) -> list[CrawledPage]:
    """Synchronous wrapper."""
    return asyncio.run(crawl_shelter(shelter_url, max_depth, max_pages))