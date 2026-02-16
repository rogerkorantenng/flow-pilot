"""WebSocket endpoint that streams live browser frames to the dashboard."""

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.executor_service import ExecutorService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["screen"])


@router.websocket("/runs/{run_id}/screen")
async def live_screen(ws: WebSocket, run_id: str):
    """Stream JPEG frames from the running browser page at ~3 fps."""
    await ws.accept()
    logger.info(f"Screen WebSocket connected for run {run_id}")

    try:
        while True:
            page = ExecutorService._run_pages.get(run_id)
            if page is None:
                # No page yet (run hasn't started or already finished)
                # Send a small status message and wait
                try:
                    await ws.send_json({"status": "waiting"})
                except Exception:
                    break
                await asyncio.sleep(1)
                continue

            try:
                # Take a JPEG screenshot — fast and small
                jpeg_bytes = await page.screenshot(type="jpeg", quality=55)
                await ws.send_bytes(jpeg_bytes)
            except Exception:
                # Page might be navigating or closed
                try:
                    await ws.send_json({"status": "capturing"})
                except Exception:
                    break

            await asyncio.sleep(0.35)  # ~3 fps

    except WebSocketDisconnect:
        logger.info(f"Screen WebSocket disconnected for run {run_id}")
    except Exception as e:
        logger.warning(f"Screen WebSocket error: {e}")
    finally:
        try:
            await ws.close()
        except Exception:
            pass
