import base64
import json
import logging
import time

import boto3
from botocore.exceptions import ClientError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class NovaService:
    def __init__(self):
        self.client = boto3.client(
            "bedrock-runtime",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )
        self._throttle_until: float = 0  # Timestamp when throttle expires

    def _is_throttled(self) -> bool:
        return time.time() < self._throttle_until

    def _handle_throttle(self, retry_after: int = 60):
        self._throttle_until = time.time() + retry_after
        logger.warning(f"Nova API throttled, backing off for {retry_after}s")

    def _invoke_text(self, prompt: str, system: str = "", max_tokens: int = 4096) -> str:
        if self._is_throttled():
            raise ThrottledError("Nova API is rate-limited, waiting for cooldown")

        messages = [{"role": "user", "content": [{"text": prompt}]}]
        body = {
            "messages": messages,
            "inferenceConfig": {"maxTokens": max_tokens, "temperature": 0.3},
        }
        if system:
            body["system"] = [{"text": system}]

        try:
            response = self.client.invoke_model(
                modelId=settings.NOVA_TEXT_MODEL,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(body),
            )
            result = json.loads(response["body"].read())
            logger.info(f"Nova text model invoked successfully ({settings.NOVA_TEXT_MODEL})")
            return result["output"]["message"]["content"][0]["text"]
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "ThrottlingException":
                self._handle_throttle(120)
                raise ThrottledError(str(e))
            raise

    def _invoke_image(self, prompt: str, image_b64: str, system: str = "", max_tokens: int = 4096) -> str:
        if self._is_throttled():
            raise ThrottledError("Nova API is rate-limited, waiting for cooldown")

        messages = [
            {
                "role": "user",
                "content": [
                    {"image": {"format": "png", "source": {"bytes": base64.b64decode(image_b64)}}},
                    {"text": prompt},
                ],
            }
        ]
        body = {
            "messages": messages,
            "inferenceConfig": {"maxTokens": max_tokens, "temperature": 0.3},
        }
        if system:
            body["system"] = [{"text": system}]

        try:
            response = self.client.invoke_model(
                modelId=settings.NOVA_IMAGE_MODEL,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(body),
            )
            result = json.loads(response["body"].read())
            logger.info(f"Nova image model invoked successfully ({settings.NOVA_IMAGE_MODEL})")
            return result["output"]["message"]["content"][0]["text"]
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "ThrottlingException":
                self._handle_throttle(120)
                raise ThrottledError(str(e))
            raise


class ThrottledError(Exception):
    """Raised when Nova API is rate-limited."""
    pass
