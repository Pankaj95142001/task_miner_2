from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from .config import (
    LANGFUSE_BASE_URL,
    LANGFUSE_DEBUG,
    LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY,
    LANGFUSE_TRACING_ENVIRONMENT,
)

try:
    from langfuse import get_client
except ImportError:
    get_client = None


def get_langfuse_status() -> dict[str, Any]:
    configured = bool(LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY)
    enabled = bool(configured and get_client is not None)
    return {
        'configured': configured,
        'enabled': enabled,
        'sdkAvailable': get_client is not None,
        'baseUrl': LANGFUSE_BASE_URL,
        'environment': LANGFUSE_TRACING_ENVIRONMENT,
        'debug': LANGFUSE_DEBUG,
    }


def get_langfuse_client() -> Any | None:
    status = get_langfuse_status()
    if not status['enabled']:
        return None
    try:
        return get_client()
    except Exception:
        return None


@contextmanager
def start_observation(
    *,
    name: str,
    as_type: str = 'span',
    input: Any | None = None,
    output: Any | None = None,
    metadata: dict[str, Any] | None = None,
    model: str | None = None,
    level: str | None = None,
    status_message: str | None = None,
) -> Iterator[Any | None]:
    client = get_langfuse_client()
    if client is None:
        yield None
        return
    try:
        context = client.start_as_current_observation(
            name=name,
            as_type=as_type,
            input=input,
            output=output,
            metadata=metadata,
            model=model,
            level=level,
            status_message=status_message,
        )
    except Exception:
        yield None
        return
    with context as observation:
        yield observation


def update_observation(observation: Any | None, **kwargs: Any) -> None:
    if observation is None:
        return
    payload = {key: value for key, value in kwargs.items() if value is not None}
    if not payload:
        return
    try:
        observation.update(**payload)
    except Exception:
        return


def flush_langfuse() -> None:
    client = get_langfuse_client()
    if client is None:
        return
    try:
        client.flush()
    except Exception:
        return
