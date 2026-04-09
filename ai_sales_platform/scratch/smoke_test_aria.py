import requests
import json
import time

URL = "http://localhost:8000/agent/chat"

TEST_CASES = [
    {"prompt": "hi", "type": "GREETING"},
    {"prompt": "RADAR: What are the top risks?", "type": "RADAR"},
    {"prompt": "ORACLE: Forecast for Westside?", "type": "ORACLE"},
    {"prompt": "CHRONOS: 30% promo shock simulation", "type": "CHRONOS"},
    {"prompt": "LOGISTICS: Inventory check for Midtown", "type": "LOGISTICS"},
    {"prompt": "EXPLAINER: What's driving Westside sales?", "type": "EXPLAINER"},
    {"prompt": "AUDITOR: How accurate is the Midtown model?", "type": "AUDITOR"},
    {"prompt": "STABILIZER: Is Westside stable?", "type": "STABILIZER"},
    {"prompt": "PROMOTER: Run a high intensity campaign", "type": "PROMOTER"},
    {"prompt": "ELASTICITY: Check price sensitivity", "type": "ELASTICITY"},
    {"prompt": "VOLATILITY: Check Midtown variance", "type": "VOLATILITY"},
    {"prompt": "MEMO: Remember that Westside is our priority", "type": "MEMO"},
    {"prompt": "GEOGRAPHER: Details for Central Station", "type": "GEOGRAPHER"},
    {"prompt": "ANOMALY: Any weird spikes today?", "type": "ANOMALY"},
    {"prompt": "TREND: What is the long term growth?", "type": "TREND"},
    {"prompt": "SURVEYOR: Give me an executive briefing", "type": "SURVEYOR"},
]

def run_test(case):
    payload = {
        "messages": [{"role": "user", "content": case["prompt"]}],
        "store": 1,
        "item": 1
    }
    start_time = time.time()
    try:
        response = requests.post(URL, json=payload, stream=True, timeout=120)
        first_token_time = None
        full_text = ""
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith("data: "):
                    if first_token_time is None:
                        first_token_time = time.time() - start_time
                    data = json.loads(line_str[6:])
                    if data["type"] == "delta":
                        full_text += data["content"]
                    if data["type"] == "done":
                        break
        
        total_time = time.time() - start_time
        return {
            "prompt": case["prompt"],
            "first_token": round(first_token_time, 3) if first_token_time else "N/A",
            "total_time": round(total_time, 3),
            "response": full_text[:50] + "...",
            "status": "PASS" if full_text else "FAIL"
        }
    except Exception as e:
        return {"prompt": case["prompt"], "status": "ERROR", "error": str(e)}

if __name__ == "__main__":
    results = []
    print("Starting ARIA Smoke Test (Simulating 50+ iterations)...")
    # We repeat the set to reach ~50
    for i in range(6): 
        for case in TEST_CASES:
            res = run_test(case)
            results.append(res)
            latency = res.get('first_token', 'ERROR')
            print(f"[{len(results)}] {res['prompt']} -> {latency}s")
            
    with open("aria_smoke_results.json", "w") as f:
        json.dump(results, f, indent=4)
    print("Smoke Test Complete. Results saved.")
