import time
from dataclasses import dataclass
from threading import RLock
from typing import Any, Dict, Optional, Tuple


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class TTLCache:
    def __init__(self) -> None:
        self._data: Dict[str, CacheEntry] = {}
        self._lock = RLock()

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            ent = self._data.get(key)
            if ent is None:
                return None
            if ent.expires_at < now:
                self._data.pop(key, None)
                return None
            return ent.value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        with self._lock:
            self._data[key] = CacheEntry(value=value, expires_at=time.time() + float(ttl_seconds))

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
