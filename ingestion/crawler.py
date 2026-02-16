"""Shelter website crawler using Crawl4AI.

Uses modern Crawl4AI configurations to spider through a shelter site and collect
clean Markdown of pet listing pages.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from typing import List

import structlog

from config.settings import get_settings

logger = structlog.get_logger(__name__)


@dataclass
class CrawledPage:
    """A single page result from the crawler."""
    url: str
    markdown: str
    title: str = ""
    depth: int = 0


async def crawl_shelter(
    shelter_url: str,
    max_depth: int | None = None,
    max_pages: int | None = None,
    delay_seconds: float | None = None,
) -> list[CrawledPage]:
    """Crawl a shelter website and return cleaned Markdown pages."""
    settings = get_settings()
    max_depth = max_depth or settings.crawl_max_depth
    max_pages = max_pages or settings.crawl_max_pages
    delay_seconds = delay_seconds or settings.crawl_delay_seconds

    # Updated imports for crawl4ai 0.4.x
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
    # Note: BFSDeepCrawlStrategy is removed as it's now internal to arun/config

    pages: list[CrawledPage] = []

    # URL filter pattern
    pet_url_patterns = re.compile(
        r"(adopt|pet|animal|dog|cat|available|listing|detail|profile)",
        re.IGNORECASE,
    )

    # In modern Crawl4AI, we define crawling behavior in the Config
    # We use CSS selectors or simple link limits to mimic BFS
    crawl_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=10,
        # 'fit_markdown' has been moved to markdown_generator or processing logic 
        # but we can enable content filtering here:
        process_iframes=False,
        remove_overlay_elements=True,
    )

    logger.info("Starting shelter crawl", url=shelter_url, max_depth=max_depth, max_pages=max_pages)

    async with AsyncWebCrawler() as crawler:
        # Modern arun_many or arun with depth handles the 'deep' crawl
        # We pass max_depth directly to arun in 0.4.x
        result = await crawler.arun(
            url=shelter_url,
            config=crawl_config,
            # Depth and crawling logic is now passed here:
            max_depth=max_depth
        )

        # Handle the result(s)
        # If arun finds internal links and follows them, it returns a list or handled internally
        results = [result] if not isinstance(result, list) else result

        for res in results:
            if not res.success:
                logger.warning("Failed to crawl page", url=res.url, error=res.error_message)
                continue

            # Filtering logic for relevant pet pages
            if not pet_url_patterns.search(res.url) and res.url.rstrip("/") != shelter_url.rstrip("/"):
                continue

            # In 0.4.x, 'fit_markdown' is often accessed via the markdown object
            markdown_content = ""
            if res.markdown:
                # If fit_markdown specifically isn't available, res.markdown is the fallback
                markdown_content = getattr(res.markdown, "fit_markdown", res.markdown)

            if len(markdown_content.strip()) < 50:
                continue

            pages.append(CrawledPage(
                url=res.url,
                markdown=markdown_content,
                title=res.metadata.get("title", "") if res.metadata else "",
                depth=getattr(res, "depth", 0),
            ))

            logger.info("Crawled page", url=res.url, markdown_chars=len(markdown_content))

    logger.info("Crawl complete", url=shelter_url, pages_collected=len(pages))
    return pages


def crawl_shelter_sync(
    shelter_url: str,
    max_depth: int | None = None,
    max_pages: int | None = None,
) -> list[CrawledPage]:
    """Synchronous wrapper."""
    return asyncio.run(crawl_shelter(shelter_url, max_depth, max_pages))