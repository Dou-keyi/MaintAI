# MaintAi

Predictive maintenance platform for industrial equipment. MaintAi combines a FastAPI backend, a React dashboard, SQLite persistence, and an XGBoost-based RUL pipeline to help managers monitor machine health, upload sensor logs, track maintenance, and decide whether to maintain or replace assets.

## What It Does

- Stores machines, sensor readings, alerts, maintenance logs, and predictions in SQLite
- Accepts CSV uploads for machine telemetry and batch sensor history
- Predicts Remaining Useful Life (RUL), health score, status, and confidence
- Shows dashboard views for machine health, alerts, maintenance history, and analytics
- Converts maintenance history plus business inputs into a maintain-vs-replace recommendation
- Uses Supabase authentication on the frontend while keeping operational data in the local backend

## Repository Structure

```text
MaintAI/
|-- Backend/
|   |-- main.py              # FastAPI app, SQLite schema, API routes
|   |-- train_FD001.txt      # NASA CMAPSS training file currently included
|   `-- __init__.py
|-- Frontend/
|   |-- public/              # Logo, favicon, static assets
|   |-- src/
|   |   |-- lib/             # API client, Supabase client
|   |   |-- pages/           # Dashboard, add/edit equipment, auth, prediction pages
|   |   |-- App.tsx
|   |   `-- main.tsx
|   |-- index.html
|   |-- package.json
|   `-- vite.config.ts
|-- data/
|   |-- sample_machine_upload.csv
|   |-- sample_warning_profile.csv
|   `-- sample_critical_profile.csv
|-- models/                  # Generated model artifacts
|-- ml_pipeline.py           # Training + inference helper for RUL prediction
|-- requirements.txt
|-- start.ps1
|-- start.sh
`-- README.md
```

## Tech Stack

- Backend: FastAPI, Pydantic, SQLite
- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts
- ML: XGBoost, scikit-learn, pandas, NumPy
- Auth: Supabase

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/maintai.git
cd maintai
```

### 2. Create a Python environment and install backend dependencies

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd Frontend
npm install
cd ..
```

### 4. Start the backend

```bash
python -m uvicorn Backend.main:app --reload --port 8000
```

Backend URLs:

- Health: `http://127.0.0.1:8000/health`
- Docs: `http://127.0.0.1:8000/docs`

### 5. Start the frontend

In a second terminal:

```bash
cd Frontend
npm run dev
```

Frontend URL:

- App: `http://localhost:5173`

## Demo Files

Sample CSVs are included in `data/`:

- `sample_machine_upload.csv`: basic telemetry upload for charts and normal machine history
- `sample_warning_profile.csv`: tuned sample for a warning status with the current trained model
- `sample_critical_profile.csv`: tuned sample for a critical status with the current trained model

Upload flow:

1. Create a machine from the dashboard or Add Equipment page
2. Use `Update CSV` on a machine card
3. Upload one of the sample files
4. Refresh the dashboard to show updated health, RUL, alerts, and charts

## Key API Endpoints

- `GET /health`
- `GET /api/dashboard`
- `GET /api/machines`
- `POST /api/machines`
- `GET /api/machines/{id}`
- `PATCH /api/machines/{id}`
- `DELETE /api/machines/{id}`
- `POST /api/machines/{id}/upload`
- `POST /api/machines/{id}/sensor-readings`
- `POST /api/machines/{id}/maintenance-logs`
- `PUT /api/machines/{id}/economics`
- `POST /api/predict`
- `POST /api/predict/upload`

## Model Notes

- `ml_pipeline.py` trains and loads the XGBoost RUL model
- If `models/model_rul.pkl` is missing, the backend falls back safely where needed
- `Backend/train_FD001.txt` is currently included in the repo for training convenience

To retrain:

```bash
python ml_pipeline.py
```

## Submission Notes

- Keep both backend and frontend in this single repository
- Do not commit secrets such as `.env` values
- Do not rely on `maintai.db` or local `models/*.pkl` being present on a judge's machine
- Judges should be able to run the backend and frontend locally from this repo alone

## Team

Update this section before submission.

- Name 1 - ML / data pipeline
- Name 2 - backend / API / database
- Name 3 - frontend / product / pitch
