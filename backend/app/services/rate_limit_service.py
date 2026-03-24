"""Simple in-memory rate limiting for public endpoints."""

from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass
from threading import Lock


@dataclass(slots=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int
    remaining: int


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._lock = Lock()
        self._events: dict[str, deque[float]] = {}

    def hit(self, key: str, max_requests: int, window_seconds: int) -> RateLimitResult:
        now = time.monotonic()
        window_start = now - window_seconds

        with self._lock:
            bucket = self._events.setdefault(key, deque())

            while bucket and bucket[0] <= window_start:
                bucket.popleft()

            if len(bucket) >= max_requests:
                retry_after = max(1, math.ceil(bucket[0] + window_seconds - now))
                return RateLimitResult(
                    allowed=False,
                    retry_after_seconds=retry_after,
                    remaining=0,
                )

            bucket.append(now)
            remaining = max(0, max_requests - len(bucket))

            if not bucket:
                self._events.pop(key, None)

            return RateLimitResult(
                allowed=True,
                retry_after_seconds=0,
                remaining=remaining,
            )


rate_limiter = InMemoryRateLimiter()
