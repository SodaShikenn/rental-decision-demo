"""Per-client request limit for the extraction endpoint: a sliding one-minute window in memory.

Counts are per process. Run one worker process per instance (the Docker image does), or move the
counts to a shared store such as Redis before scaling out horizontally."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import FastAPI


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float = 60.0, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = self._clock()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            if len(self._hits) > 10_000:  # drop idle clients so memory stays bounded
                for idle in [client for client, times in self._hits.items() if not times]:
                    del self._hits[idle]
            return True


def init_app(app: FastAPI) -> None:
    app.state.rate_limiter = SlidingWindowLimiter(app.state.settings.rate_limit_per_minute)
