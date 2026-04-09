import os
import json

MEMORY_FILE = "aria_memory_log.json"

def get_memory() -> str:
    if not os.path.exists(MEMORY_FILE):
        return "No permanent memories logged yet."
    try:
        with open(MEMORY_FILE, "r") as f:
            data = json.load(f)
        if not data:
            return "No permanent memories logged yet."
        return "\n".join(f"- {item}" for item in data)
    except Exception:
        return "Memory heavily corrupted."

def add_memory(insight: str) -> str:
    data = []
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, "r") as f:
                data = json.load(f)
        except Exception:
            data = []
    data.append(insight)
    # Retain the most recent 50 core memories
    with open(MEMORY_FILE, "w") as f:
        json.dump(data[-50:], f, indent=4)
    return "Core memory successfully updated and synchronized."
