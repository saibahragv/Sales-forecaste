from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import random

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # Simple dispatcher for future logic
            if payload.get("action") == "subscribe_risk":
                asyncio.create_task(stream_risk_flags(websocket, payload))
            elif payload.get("action") == "subscribe_shap":
                asyncio.create_task(stream_shap_generation(websocket, payload))
            else:
                await websocket.send_text(json.dumps({"status": "connected", "msg": "waiting for commands"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def stream_risk_flags(websocket: WebSocket, payload: dict):
    # Simulate an anomaly watchdog (Feature 8)
    store = payload.get("store", 1)
    item = payload.get("item", 1)
    
    # Send 5 simulation steps
    for i in range(5):
        await asyncio.sleep(2)  # Check every 2 secs
        is_anomaly = random.random() > 0.8
        risk_level = random.uniform(0.1, 0.9) if not is_anomaly else random.uniform(0.8, 1.0)
        
        await websocket.send_text(json.dumps({
            "type": "risk_flag",
            "store": store,
            "item": item,
            "is_anomaly": is_anomaly,
            "risk_score": round(risk_level, 2),
            "timestamp": i
        }))

async def stream_shap_generation(websocket: WebSocket, payload: dict):
    # Simulate step-by-step SHAP explainability generation (Feature 1)
    store = payload.get("store", 1)
    item = payload.get("item", 1)
    
    total_steps = 10
    for i in range(1, total_steps + 1):
        await asyncio.sleep(0.5) 
        await websocket.send_text(json.dumps({
            "type": "shap_progress",
            "progress": round((i / total_steps) * 100),
            "status": f"Calculating permutation {i} of {total_steps}"
        }))
        
    await websocket.send_text(json.dumps({
        "type": "shap_complete",
        "result": {
            "price_elasticity": 0.35,
            "competitor_promo": 0.22,
            "seasonality": 0.15
        }
    }))
