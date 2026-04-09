# AI Sales Intelligence Platform

An enterprise-grade forecasting and analytics system powered by LightGBM and SHAP.

> **🆕 New to the Platform?**
> Read our [Detailed Guide & Documentation](./DOCUMENTATION.md) to understand the data, the AI model, and every button in the interface.

## 🚀 Quick Start (Windows)

The simplest way to run the platform is using the automated launcher:

1. **Start the Platform**:
   Double-click `start.bat` or run in your terminal:
   ```cmd
   python start.py
   ```

2. **Access the System**:
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🏗️ Project Structure

- `backend/`: FastAPI gateway, modular services, and LightGBM inference engine.
- `frontend/`: React (Vite + TypeScript) enterprise UI with premium dark theme.
- `start.py` / `start.bat`: Automated environment check, dependency installation, and process management.

---

## 🛠️ Manual Setup

If you prefer to manage the services manually:

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv ../.venv
../.venv/Scripts/pip install -r requirements.txt
../.venv/Scripts/python main.py
```

### 2. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

---

## 📈 Key Features at a Glance

For a deep dive into each feature, see the [Full Documentation](./DOCUMENTATION.md).

- **Executive Overview**: High-level KPIs and automated demand health summaries.
- **Forecast Explorer**: Interactive forecast curves with seasonal decomposition.
- **Scenario Simulation**: "What-if" analysis for pricing, promotions, and macro shocks.
- **Risk & Stability**: Volatility tracking and confidence interval generation.
- **Explainability**: SHAP-based global and local feature attribution.
- **AI Assistant**: Natural language interface for interpreting metrics.

---

## 🔧 Prerequisites

- **Python 3.10 – 3.12 (64-bit)**: Required for `numpy`/`pandas`/`shap` compatibility.
- **Node.js 18+**: Required for the React frontend.

## 📝 Troubleshooting

- **Empty Filters**: Ensure the backend is running and check [http://localhost:8000/hierarchy](http://localhost:8000/hierarchy).
- **Module Errors**: Run `start.bat` to ensure all dependencies are correctly installed in the `.venv`.
- **Python 3.13**: Currently unsupported due to `numpy` wheel availability. Please use 3.12.
