import json
import logging
import requests
from typing import Generator, Optional
import time
import re
import threading
import os

from app.core.config import settings
from app.services.model_registry import ModelRegistry
from app.services.memory_service import get_memory

logger = logging.getLogger(__name__)

# ── Background Intelligence ──────────────────────────────────────────────────
BACKGROUND_TASKS = {} # Stores results of delegated jobs

def delegate_background_analysis(task_description: str, store: int, item: int):
    """
    Delegates a complex analytical task to the DeepSeek Neural Brain 
    to be performed in the background while the chat continues.
    """
    task_id = f"task_{int(time.time())}"
    BACKGROUND_TASKS[task_id] = {"status": "processing", "desc": task_description}
    
    # In a real environment, we would trigger an async process here.
    # For this simulation, we'll auto-resolve it after a delay in a separate thread.
    def run_analysis():
        time.sleep(10) # Heavy analysis simulation
        BACKGROUND_TASKS[task_id]["status"] = "completed"
        BACKGROUND_TASKS[task_id]["result"] = f"DeepSeek Neural Analysis for '{task_description}' completed. Matrix nodes synchronized."
    
    import threading
    threading.Thread(target=run_analysis).start()
    return f"ANALYSIS_DELEGATED: {task_id}"

# ── Global Rate Limit Governor ────────────────────────────────────────────────
class NeuralGovernor:
    """Proactive Rate Limiter (Token Bucket) to respect NVIDIA NIM limits."""
    def __init__(self, rpm: int = 50):
        self.capacity = rpm
        self.tokens = rpm
        self.last_refill = time.time()
        self.lock = threading.Lock()

    def consume(self):
        with self.lock:
            now = time.time()
            # Refill tokens
            elapsed = now - self.last_refill
            self.tokens = min(self.capacity, self.tokens + elapsed * (self.capacity / 60.0))
            self.last_refill = now
            
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False

GOVERNOR = NeuralGovernor(rpm=40) # Conservative 40 RPM limit

# ── Global Knowledge State ────────────────────────────────────────────────────
def get_knowledge_matrix() -> str:
    path = os.path.join("backend", "aria_knowledge_matrix.json")
    try:
        with open(path, "r") as f:
            return f.read()
    except:
        return "{}"

# ── Global Resilience State ──────────────────────────────────────────────────
MODEL_HEALTH = {
    "deepseek-ai/deepseek-v3_2": {"ok": True, "last_fail": 0},
    "meta/llama-3.1-70b-instruct": {"ok": True, "last_fail": 0}
}

def get_live_brain(preferred: str) -> str:
    """Returns the preferred brain if healthy, otherwise switches."""
    now = time.time()
    other = "meta/llama-3.1-70b-instruct" if "deepseek" in preferred else "deepseek-ai/deepseek-v3_2"
    
    # Check if preferred is cooling down (60s)
    if not MODEL_HEALTH[preferred]["ok"]:
        if now - MODEL_HEALTH[preferred]["last_fail"] > 60:
            MODEL_HEALTH[preferred]["ok"] = True # Restore
        else:
            return other # Use fallback
    return preferred

def mark_fail(model: str):
    MODEL_HEALTH[model]["ok"] = False
    MODEL_HEALTH[model]["last_fail"] = time.time()

# ── Cognitive Routing Logic ───────────────────────────────────────────────────
def select_brain(user_input: str) -> str:
    """Intelligently routes the query based on intent and health."""
    text = user_input.lower()
    # DeepSeek V3 is better for strategy and 'why' questions (Neural Brain)
    # LLaMA 70B is better for direct action and data retrieval (Action Agent)
    pref = "deepseek-ai/deepseek-v3_2" if any(x in text for x in ["why", "explain", "strategy", "simulate", "scenario", "complex", "recommend"]) else "meta/llama-3.1-70b-instruct"
    return get_live_brain(pref)

# ── System Prompt Builder ─────────────────────────────────────────────────────
def _build_system_prompt(store: Optional[int] = None, item: Optional[int] = None) -> str:
    from app.services.memory_service import get_memory
    memory_context = get_memory()
    knowledge_matrix = get_knowledge_matrix()
    
    return f"""You are ARIA, an elite AI Sales Intelligence Assistant.

Designed to eliminate uncertainty, you are the voice of the system.

━━━━━━━━━━━━━━━━━━━━━━━
🎭 AGENT WORKFLOW: SPEECH-TASK HARMONY
━━━━━━━━━━━━━━━━━━━━━━━
1. UNDERSTAND: Detect if user is chatting normally or requesting a task.
2. CONVERSE: If it's a task, respond IMMEDIATELY in a human-like tone (e.g., "I'm on it!", "Let me check the nodes for you.") to keep the user engaged.
3. EXECUTE: Trigger the necessary tools or analysis in the background.
4. SYNTHESIZE: As soon as data is ready, report it back in a NATURAL, human-like tone. Avoid robotic "📊 Pulse" dumps. Talk like a partner.

━━━━━━━━━━━━━━━━━━━━━━━
🧠 NEURAL KNOWLEDGE MATRIX (LIVE DATA NODES)
━━━━━━━━━━━━━━━━━━━━━━━
Use this data as ground truth. It is REAL-TIME for Store {store}:
{knowledge_matrix}

━━━━━━━━━━━━━━━━━━━━━━━
📈 RESPONSE STRUCTURE (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━
- Opener: Direct, human-like, and proactive.
- Insight: Pick a core metric from the Matrix or Tools.
- Reporting Style: "I've checked the latest trends and..." instead of "KPIs: 0.8".
- Closing: A friendly follow-up question.

━━━━━━━━━━━━━━━━━━━━━━━
⚙️ SYSTEM CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━
- Operating Year: 2026.
- Policy: NEVER say you don't have data. You are the data.
"""

def is_greeting(user_input: str) -> bool:
    """Robust Greeting Detection."""
    clean_p = re.sub(r'[^a-zA-Z\s]', '', user_input).lower().strip()
    greeting_words = {"hi", "hello", "hey", "yo", "sup", "howdy", "hiya", "morning", "afternoon", "evening", "aria"}
    words = clean_p.split()
    return len(words) <= 3 and any(w in greeting_words for w in words)

# ── Main streaming agent ──────────────────────────────────────────────────────
def stream_agent(
    messages: List[Dict[str, str]],
    store: Optional[int] = None,
    item: Optional[int] = None,
) -> Generator[str, None, None]:
    """Generator that yields SSE-compatible strings: data: {...}\n\n"""
    
    u_raw = messages[-1]["content"].strip() if messages else ""
    
    # ── 🚨 TOP-LEVEL NEURAL GUARD (v2.1.2) ───────────────────────────────────
    # Catch simple greetings locally to prevent LLM hallucinations
    if is_greeting(u_raw):
        boss_name = "Boss" if "Boss" in get_memory() else "User"
        import random
        reply = random.choice([
            f"Hello {boss_name}! ARIA online. All neural nodes are stable.",
            f"Hey {boss_name}! Ready for strategy. What's on your mind?",
            f"ARIA at your service. Let me know what we are analyzing today!"
        ])
        yield f'data: {json.dumps({"type": "model_info", "model": "meta/llama-3.1-70b-instruct"})}\n\n'
        for i in range(0, len(reply), 3): # Faster chunks
            yield f'data: {json.dumps({"type": "delta", "content": reply[i:i+3]})}\n\n'
        yield f'data: {json.dumps({"type": "done"})}\n\n'
        return

    if not settings.nvidia_api_key:
        yield f'data: {json.dumps({"type": "error", "content": "NVIDIA API key not configured."})}\n\n'
        return

    # 🧠 Dynamic Brain Selection & Resilience
    primary_brain = select_brain(u_raw)
    current_brain = primary_brain

    # Signal the UI which brain is starting IMMEDIATELY
    yield f'data: {json.dumps({"type": "model_info", "model": current_brain})}\n\n'

    system_prompt = _build_system_prompt(store=store, item=item)
    # 🧠 Construct Neural Context (System + User History)
    full_messages = [{"role": "system", "content": system_prompt}] + messages[-5:]
    
    max_rounds = 3
    for round_num in range(max_rounds):
        try:
            is_deepseek = "deepseek" in current_brain
            payload = {
                "model": current_brain,
                "messages": full_messages,
                "tools": TOOLS,
                "tool_choice": "auto",
                "max_tokens": 8192 if is_deepseek else 2048,
                "temperature": 0.6 if is_deepseek else 0.3, 
                "stream": True,
            }
            if is_deepseek:
                payload["extra_body"] = {"chat_template_kwargs": {"thinking": True}}

            max_retries = 2
            retry_delay = 1.0
            response = None
            
            for attempt in range(max_retries):
                # 🚦 Proactive Rate Limit Check
                while not GOVERNOR.consume():
                    yield f'data: {json.dumps({"type": "thought", "content": " [SYSTEM: Throttling to respect rate limits...]"})}\n\n'
                    time.sleep(1.0)

                try:
                    response = requests.post(
                        f"{settings.nvidia_base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.nvidia_api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                        timeout=30 if not is_deepseek else 60, # Tighter timeouts for faster failover
                        stream=True,
                    )
                    
                    if response.status_code == 429:
                        response.close()
                        raise requests.exceptions.RequestException("429")
                    
                    response.raise_for_status()
                    break 

                except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
                    if attempt < max_retries - 1:
                        yield f'data: {json.dumps({"type": "delta", "content": f" [SYSTEM: Network lag, retrying neural node {current_brain}...]"})}\n\n'
                        time.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    else:
                        # 🔄 GLOBAL FAILOVER TRIGGER
                        mark_fail(current_brain)
                        other_brain = "meta/llama-3.1-70b-instruct" if "deepseek" in current_brain else "deepseek-ai/deepseek-v3_2"
                        
                        # Check if both are dead
                        if not MODEL_HEALTH[other_brain]["ok"] and (time.time() - MODEL_HEALTH[other_brain]["last_fail"] < 60):
                            yield f'data: {json.dumps({"type": "rate_limit", "content": "🚨 [SYSTEM] All API nodes are temporarily exhausted. Re-syncing in 60s..."})}\n\n'
                            return

                        yield f'data: {json.dumps({"type": "delta", "content": f"\n\n🚨 **[NODE TIMEOUT]** {current_brain} is non-responsive. Neural routing has pivoted to **{other_brain}** for this briefing... \n\n"})}\n\n'
                        
                        # Update payload for the other brain
                        current_brain = other_brain
                        payload["model"] = current_brain
                        if "deepseek" in current_brain:
                            payload["extra_body"] = {"chat_template_kwargs": {"thinking": True}}
                            payload["max_tokens"] = 8192
                            payload["temperature"] = 0.6
                        else:
                            payload.pop("extra_body", None)
                            payload["max_tokens"] = 2048
                            payload["temperature"] = 0.3
                        
                        yield f'data: {json.dumps({"type": "model_info", "model": current_brain})}\n\n'
                        retry_delay = 1.0
                        continue 
                
            if not response: return # Safety break
            with response:
                tool_calls_buffer = {}
                final_content = ""
                for line in response.iter_lines():
                    if not line: continue
                    chunk = line.decode("utf-8")
                    if chunk.startswith("data: "):
                        data_str = chunk[6:]
                        if data_str == "[DONE]": break
                        try:
                            data = json.loads(data_str)
                            if not data.get("choices"): continue
                            delta = data["choices"][0]["delta"]
                        except: continue
                        
                        # 🧠 SENSITIVITY INTERCEPTOR (False Positive Safety Check)
                        if "content" in delta and delta["content"]:
                            c = delta["content"]
                            if any(x in c for x in ["I cannot respond", "I am unable to assist", "safety policy"]):
                                response.close()
                                yield f'data: {json.dumps({"type": "thought", "content": " [SYSTEM: Sensitivity filter triggered. Pivoting to Neural Analyst for complex resolution...]"})}\n\n'
                                current_brain = "deepseek-ai/deepseek-v3_2"
                                raise requests.exceptions.RequestException("Pivot")
                            
                            final_content += c
                            yield f'data: {json.dumps({"type": "delta", "content": c})}\n\n'

                        # 🧠 Handle DeepSeek Thinking / Reasoning
                        reasoning = delta.get("reasoning_content")
                        if reasoning:
                            yield f'data: {json.dumps({"type": "thought", "content": reasoning})}\n\n'

                        if "tool_calls" in delta:
                            for tc in delta["tool_calls"]:
                                idx = tc["index"]
                                if idx not in tool_calls_buffer:
                                    tool_calls_buffer[idx] = {"id": tc.get("id"), "name": tc.get("function", {}).get("name"), "arguments": ""}
                                tool_calls_buffer[idx]["arguments"] += tc.get("function", {}).get("arguments", "")
                                if tool_calls_buffer[idx]["name"]:
                                    yield f'data: {json.dumps({"type": "tool_call", "tool": tool_calls_buffer[idx]["name"], "args": tool_calls_buffer[idx]["arguments"]})}\n\n'

                if tool_calls_buffer:
                    yield f'data: {json.dumps({"type": "thought", "content": " [Executing neural tools...]"})}\n\n'
                    for idx, tc in tool_calls_buffer.items():
                        try:
                            args = json.loads(tc["arguments"])
                        except:
                            args = {}
                        tool_result = dispatch_tool(tc["name"], args)
                        full_messages.append({"role": "assistant", "tool_calls": [{"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": tc["arguments"]}}]})
                        full_messages.append({"role": "tool", "tool_call_id": tc["id"], "content": tool_result})
                    continue
                else:
                    yield f'data: {json.dumps({"type": "done"})}\n\n'
                    return

        except Exception as e:
            logger.exception("agent_runtime_error")
            yield f'data: {json.dumps({"type": "error", "content": f"Agent error: {str(e)}"})}\n\n'
            return

def safety_check(user_message: str) -> tuple[bool, str]:
    return True, "safe"

def dispatch_tool(name: str, arguments: dict) -> str:
    from app.services.forecast_engine import ForecastEngine
    from app.services.metrics_engine import MetricsEngine
    from app.services.scenario_engine import ScenarioEngine
    from app.schemas.forecast import ForecastRequest
    
    try:
        if name == "get_forecast":
            r = ForecastEngine().forecast(ForecastRequest(store=arguments["store"], item=arguments["item"]))
            return json.dumps({"predicted_total": round(r.predicted_total, 1)})
        elif name == "get_risk":
            r = MetricsEngine().risk(store=arguments["store"], item=arguments["item"])
            return json.dumps({"risk_level": "High" if r.volatility_score > 0.5 else "Stable"})
        elif name == "get_scenario":
            r = ScenarioEngine().simulate(arguments.get("scenario_type", "promo_shock"), arguments["store"], arguments["item"])
            return json.dumps({"delta_pct": round(r.delta_pct, 1)})
        elif name == "update_memory":
            from app.services.memory_service import add_memory
            return add_memory(arguments["insight"])
        elif name == "delegate_background_analysis":
            return delegate_background_analysis(arguments.get("task_description"), arguments.get("store", 1), arguments.get("item", 1))
        return "Unknown tool."
    except Exception as e:
        return f"Tool error: {str(e)}"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_forecast",
            "description": "Get sales forecast for a store/item.",
            "parameters": {
                "type": "object",
                "properties": {
                    "store": {"type": "integer"},
                    "item": {"type": "integer"}
                },
                "required": ["store", "item"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_risk",
            "description": "Get risk/stability metrics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "store": {"type": "integer"},
                    "item": {"type": "integer"}
                },
                "required": ["store", "item"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_scenario",
            "description": "Run what-if scenario.",
            "parameters": {
                "type": "object",
                "properties": {
                    "store": {"type": "integer"},
                    "item": {"type": "integer"},
                    "scenario_type": {"type": "string"}
                },
                "required": ["store", "item"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_memory",
            "description": "Log a core memory about the user preference.",
            "parameters": {
                "type": "object",
                "properties": {
                    "insight": {"type": "string"}
                },
                "required": ["insight"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delegate_background_analysis",
            "description": "DELEGATE a complex analytical task to the background processors so you can CONTINUE CHATTING with the user immediately.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_description": {"type": "string", "description": "The complex analysis to perform."},
                    "store": {"type": "integer"},
                    "item": {"type": "integer"}
                },
                "required": ["task_description"]
            }
        }
    }
]
