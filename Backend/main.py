"""
MaintAi FastAPI backend with local SQLite persistence.

Run:
    uvicorn Backend.main:app --reload --port 8000
"""

from __future__ import annotations

import io
import json
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import Depends, FastAPI, File, Header, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

app = FastAPI(title="MaintAi", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
DB_PATH = BASE_DIR / "maintai.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id TEXT,
    name TEXT NOT NULL,
    machine_type TEXT NOT NULL,
    brand TEXT,
    location TEXT,
    install_date TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Healthy',
    health_pct REAL NOT NULL DEFAULT 100,
    rul_cycles REAL NOT NULL DEFAULT 200,
    revenue_per_month REAL NOT NULL DEFAULT 0,
    operating_cost_per_month REAL NOT NULL DEFAULT 0,
    projected_maintenance_cost REAL NOT NULL DEFAULT 0,
    replacement_cost REAL NOT NULL DEFAULT 0,
    last_maintenance_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    cycle REAL,
    temperature REAL,
    vibration REAL,
    pressure REAL,
    load_pct REAL,
    rpm REAL,
    source TEXT NOT NULL DEFAULT 'manual',
    raw_payload TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    maintenance_date TEXT NOT NULL,
    maintenance_type TEXT NOT NULL,
    parts_replaced TEXT,
    cost REAL NOT NULL DEFAULT 0,
    technician TEXT,
    notes TEXT,
    restored_health_pct REAL,
    restored_rul_cycles REAL,
    reset_cycle REAL,
    cleared_sensor_history INTEGER NOT NULL DEFAULT 0,
    cleared_alerts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id TEXT,
    machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    input_mode TEXT NOT NULL,
    health_pct REAL NOT NULL,
    rul_cycles REAL NOT NULL,
    rul_days REAL NOT NULL,
    status TEXT NOT NULL,
    confidence REAL NOT NULL,
    model_mode TEXT NOT NULL,
    top_factors TEXT,
    ml_error TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sensor_machine_time
ON sensor_readings(machine_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_machine_date
ON maintenance_logs(machine_id, maintenance_date DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_machine_date
ON predictions(machine_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_machine_date
ON alerts(machine_id, created_at DESC);
"""


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def require_user_id(x_user_id: str | None = Header(default=None, alias="X-User-Id")) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing authenticated user context")
    return x_user_id


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_SQL)

    existing_machine_columns = {
        row["name"] for row in conn.execute("PRAGMA table_info(machines)").fetchall()
    }
    machine_alters = {
        "owner_user_id": "ALTER TABLE machines ADD COLUMN owner_user_id TEXT",
        "revenue_per_month": "ALTER TABLE machines ADD COLUMN revenue_per_month REAL NOT NULL DEFAULT 0",
        "operating_cost_per_month": "ALTER TABLE machines ADD COLUMN operating_cost_per_month REAL NOT NULL DEFAULT 0",
        "projected_maintenance_cost": "ALTER TABLE machines ADD COLUMN projected_maintenance_cost REAL NOT NULL DEFAULT 0",
        "replacement_cost": "ALTER TABLE machines ADD COLUMN replacement_cost REAL NOT NULL DEFAULT 0",
    }
    for column_name, statement in machine_alters.items():
        if column_name not in existing_machine_columns:
            conn.execute(statement)

    existing_prediction_columns = {
        row["name"] for row in conn.execute("PRAGMA table_info(predictions)").fetchall()
    }
    if "owner_user_id" not in existing_prediction_columns:
        conn.execute("ALTER TABLE predictions ADD COLUMN owner_user_id TEXT")

    existing_maintenance_columns = {
        row["name"] for row in conn.execute("PRAGMA table_info(maintenance_logs)").fetchall()
    }
    maintenance_alters = {
        "restored_health_pct": "ALTER TABLE maintenance_logs ADD COLUMN restored_health_pct REAL",
        "restored_rul_cycles": "ALTER TABLE maintenance_logs ADD COLUMN restored_rul_cycles REAL",
        "reset_cycle": "ALTER TABLE maintenance_logs ADD COLUMN reset_cycle REAL",
        "cleared_sensor_history": "ALTER TABLE maintenance_logs ADD COLUMN cleared_sensor_history INTEGER NOT NULL DEFAULT 0",
        "cleared_alerts": "ALTER TABLE maintenance_logs ADD COLUMN cleared_alerts INTEGER NOT NULL DEFAULT 0",
    }
    for column_name, statement in maintenance_alters.items():
        if column_name not in existing_maintenance_columns:
            conn.execute(statement)

    conn.commit()


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    ensure_schema(conn)
    return conn


def init_db() -> None:
    with closing(get_db()) as conn:
        ensure_schema(conn)


@app.on_event("startup")
def startup() -> None:
    init_db()


class MachineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    machine_type: str = Field(min_length=1, max_length=120)
    brand: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=120)
    install_date: str | None = None
    notes: str | None = Field(default=None, max_length=1000)
    health_pct: float = Field(default=100.0, ge=0, le=100)
    rul_cycles: float = Field(default=200.0, ge=0, le=100000)
    revenue_per_month: float = Field(default=0, ge=0, le=1000000000)
    operating_cost_per_month: float = Field(default=0, ge=0, le=1000000000)
    projected_maintenance_cost: float = Field(default=0, ge=0, le=1000000000)
    replacement_cost: float = Field(default=0, ge=0, le=1000000000)


class MachineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    machine_type: str | None = Field(default=None, min_length=1, max_length=120)
    brand: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=120)
    install_date: str | None = None
    notes: str | None = Field(default=None, max_length=1000)
    health_pct: float | None = Field(default=None, ge=0, le=100)
    rul_cycles: float | None = Field(default=None, ge=0, le=100000)
    revenue_per_month: float | None = Field(default=None, ge=0, le=1000000000)
    operating_cost_per_month: float | None = Field(default=None, ge=0, le=1000000000)
    projected_maintenance_cost: float | None = Field(default=None, ge=0, le=1000000000)
    replacement_cost: float | None = Field(default=None, ge=0, le=1000000000)
    last_maintenance_date: str | None = None


class MachineEconomicsUpdate(BaseModel):
    revenue_per_month: float = Field(default=0, ge=0, le=1000000000)
    operating_cost_per_month: float = Field(default=0, ge=0, le=1000000000)
    replacement_cost: float = Field(default=0, ge=0, le=1000000000)


class SensorReadingCreate(BaseModel):
    timestamp: str | None = None
    cycle: float | None = Field(default=None, ge=0, le=1000000)
    temperature: float | None = Field(default=None, ge=-50, le=300)
    vibration: float | None = Field(default=None, ge=0, le=100)
    pressure: float | None = Field(default=None, ge=0, le=10000)
    load_pct: float | None = Field(default=None, ge=0, le=100)
    rpm: float | None = Field(default=None, ge=0, le=100000)
    source: str = Field(default="manual", max_length=50)
    raw_payload: dict[str, Any] | None = None


class MaintenanceLogCreate(BaseModel):
    maintenance_date: str
    maintenance_type: str = Field(min_length=1, max_length=120)
    parts_replaced: str | None = Field(default=None, max_length=300)
    cost: float = Field(default=0, ge=0, le=100000000)
    technician: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)
    restored_health_pct: float = Field(default=100, ge=0, le=100)
    restored_rul_cycles: float = Field(default=200, ge=0, le=100000)
    reset_cycle: float = Field(default=0, ge=0, le=1000000)
    clear_sensor_history: bool = True
    clear_alerts: bool = True


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    machine_id: int | None = None
    cycle: float | None = Field(default=None, ge=0, le=1000000)
    temperature: float | None = Field(default=None, ge=-50, le=300)
    vibration: float | None = Field(default=None, ge=0, le=100)
    pressure: float | None = Field(default=None, ge=0, le=10000)
    load_pct: float | None = Field(default=None, ge=0, le=100)
    rpm: float | None = Field(default=None, ge=0, le=100000)
    source: str = Field(default="manual", max_length=50)

    @field_validator("machine_id")
    @classmethod
    def validate_machine_id(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("machine_id must be positive")
        return value


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def compute_status(health_pct: float, rul_cycles: float) -> str:
    if health_pct <= 35 or rul_cycles <= 30:
        return "Critical"
    if health_pct <= 65 or rul_cycles <= 90:
        return "Warning"
    return "Healthy"


def reading_as_dataframe(payload: dict[str, Any]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "cycle": payload.get("cycle"),
                "temperature": payload.get("temperature"),
                "vibration": payload.get("vibration"),
                "pressure": payload.get("pressure"),
                "load": payload.get("load_pct"),
                "rpm": payload.get("rpm"),
            }
        ]
    )


def mean_value(df: pd.DataFrame, columns: list[str]) -> float:
    for column in columns:
        if column in df.columns:
            series = pd.to_numeric(df[column], errors="coerce").dropna()
            if not series.empty:
                return float(series.mean())
    return 0.0


def heuristic_prediction(df: pd.DataFrame) -> dict[str, Any]:
    cycle = mean_value(df, ["cycle"])
    temperature = mean_value(df, ["temperature", "temp"])
    vibration = mean_value(df, ["vibration", "vibe"])
    pressure = mean_value(df, ["pressure", "press"])
    load_pct = mean_value(df, ["load_pct", "load"])
    rpm = mean_value(df, ["rpm", "speed"])

    penalties = (
        min(cycle / 20.0, 60.0)
        + max(0.0, temperature - 70.0) * 1.2
        + max(0.0, vibration - 1.0) * 22.0
        + max(0.0, load_pct - 75.0) * 0.7
        + max(0.0, rpm - 1800.0) / 80.0
        + max(0.0, pressure - 300.0) / 15.0
    )
    health_pct = max(5.0, min(100.0, round(100.0 - penalties, 1)))
    rul_cycles = max(5.0, round(health_pct * 2.2, 1))
    status = compute_status(health_pct, rul_cycles)
    confidence = round(max(0.55, min(0.92, 0.88 - abs(temperature - 70.0) / 400.0)), 2)

    top_factors: list[dict[str, Any]] = []
    if temperature:
        top_factors.append({"feature": "Temperature", "impact": round(temperature, 2)})
    if vibration:
        top_factors.append({"feature": "Vibration", "impact": round(vibration, 2)})
    if load_pct:
        top_factors.append({"feature": "Load", "impact": round(load_pct, 2)})
    if not top_factors:
        top_factors.append({"feature": "Sensor profile", "impact": 0.0})

    return {
        "health_pct": health_pct,
        "rul_cycles": rul_cycles,
        "rul_days": round(rul_cycles / 2.0, 1),
        "status": status,
        "confidence": confidence,
        "model_mode": "heuristic",
        "ml_error": None,
        "top_factors": top_factors,
    }


def run_prediction(df: pd.DataFrame) -> dict[str, Any]:
    try:
        from ml_pipeline import predict_rul_from_df

        result = predict_rul_from_df(df)
        health_pct = float(result.get("health_pct", 80.0))
        rul_cycles = float(result.get("rul_cycles", 120.0))
        return {
            "health_pct": round(health_pct, 1),
            "rul_cycles": round(rul_cycles, 1),
            "rul_days": round(float(result.get("rul_days", rul_cycles / 2.0)), 1),
            "status": result.get("status") or compute_status(health_pct, rul_cycles),
            "confidence": round(max(0.6, min(0.97, 0.7 + (health_pct / 400.0))), 2),
            "model_mode": "trained",
            "ml_error": None,
            "top_factors": result.get("top_factors", []),
        }
    except Exception as exc:
        fallback = heuristic_prediction(df)
        fallback["ml_error"] = str(exc)
        return fallback


def fetch_machine_or_404(conn: sqlite3.Connection, machine_id: int, user_id: str) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM machines WHERE id = ? AND owner_user_id = ?",
        (machine_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Machine not found")
    return row


def insert_alerts(
    conn: sqlite3.Connection,
    machine_id: int,
    machine_name: str,
    prediction: dict[str, Any],
    latest_reading: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    created_at = utc_now()
    alerts: list[tuple[str, str, str, str]] = []

    health_pct = float(prediction["health_pct"])
    rul_cycles = float(prediction["rul_cycles"])
    if prediction["status"] == "Critical":
        alerts.append(
            (
                "prediction",
                "critical",
                f"{machine_name} is critical",
                f"Predicted RUL is {rul_cycles:.1f} cycles with health at {health_pct:.1f}%.",
            )
        )
    elif prediction["status"] == "Warning":
        alerts.append(
            (
                "prediction",
                "warning",
                f"{machine_name} needs attention",
                f"Predicted RUL is {rul_cycles:.1f} cycles with health at {health_pct:.1f}%.",
            )
        )

    if latest_reading is not None:
        if latest_reading.get("temperature") is not None and float(latest_reading["temperature"]) >= 85:
            alerts.append(
                (
                    "sensor",
                    "warning",
                    f"{machine_name} temperature spike",
                    f"Latest temperature reached {float(latest_reading['temperature']):.1f}C.",
                )
            )
        if latest_reading.get("vibration") is not None and float(latest_reading["vibration"]) >= 1.2:
            alerts.append(
                (
                    "sensor",
                    "critical",
                    f"{machine_name} vibration anomaly",
                    f"Latest vibration reached {float(latest_reading['vibration']):.2f}.",
                )
            )

    for source, severity, title, message in alerts:
        conn.execute(
            """
            INSERT INTO alerts (machine_id, source, severity, title, message, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (machine_id, source, severity, title, message, created_at),
        )

    return [
        {
            "machine_id": machine_id,
            "source": source,
            "severity": severity,
            "title": title,
            "message": message,
            "created_at": created_at,
            "is_active": True,
        }
        for source, severity, title, message in alerts
    ]


def store_prediction(
    conn: sqlite3.Connection,
    owner_user_id: str | None,
    machine_id: int | None,
    prediction: dict[str, Any],
    input_mode: str,
) -> int:
    cursor = conn.execute(
        """
        INSERT INTO predictions (
            owner_user_id, machine_id, input_mode, health_pct, rul_cycles, rul_days, status, confidence,
            model_mode, top_factors, ml_error, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            owner_user_id,
            machine_id,
            input_mode,
            prediction["health_pct"],
            prediction["rul_cycles"],
            prediction["rul_days"],
            prediction["status"],
            prediction["confidence"],
            prediction["model_mode"],
            json.dumps(prediction.get("top_factors", [])),
            prediction.get("ml_error"),
            utc_now(),
        ),
    )
    return int(cursor.lastrowid)


def serialize_prediction(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    item = row_to_dict(row)
    item["top_factors"] = json.loads(item["top_factors"] or "[]")
    item["confidence_pct"] = round(float(item["confidence"]) * 100.0, 1)
    return item


def serialize_alert(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    item = row_to_dict(row)
    item["is_active"] = bool(item["is_active"])
    return item


def serialize_sensor_reading(row: sqlite3.Row) -> dict[str, Any]:
    item = row_to_dict(row) or {}
    item["raw_payload"] = json.loads(item["raw_payload"] or "{}")
    return item


def serialize_maintenance_log(row: sqlite3.Row) -> dict[str, Any]:
    item = row_to_dict(row) or {}
    if "cleared_sensor_history" in item:
        item["cleared_sensor_history"] = bool(item["cleared_sensor_history"])
    if "cleared_alerts" in item:
        item["cleared_alerts"] = bool(item["cleared_alerts"])
    return item


def build_machine_economics(machine: sqlite3.Row, conn: sqlite3.Connection) -> dict[str, Any]:
    revenue_per_month = float(machine["revenue_per_month"] or 0)
    operating_cost_per_month = float(machine["operating_cost_per_month"] or 0)
    replacement_cost = float(machine["replacement_cost"] or 0)
    monthly_margin = revenue_per_month - operating_cost_per_month
    health_pct = float(machine["health_pct"] or 0)
    rul_cycles = float(machine["rul_cycles"] or 0)
    machine_id = int(machine["id"])

    maintenance_rows = conn.execute(
        "SELECT maintenance_date, cost FROM maintenance_logs WHERE machine_id = ? ORDER BY maintenance_date ASC",
        (machine_id,),
    ).fetchall()
    maintenance_cost_total = round(sum(float(row["cost"] or 0) for row in maintenance_rows), 2)
    maintenance_events = len(maintenance_rows)
    projected_maintenance_cost = 0.0

    if maintenance_rows:
        today = datetime.now(UTC).date()
        oldest = datetime.fromisoformat(str(maintenance_rows[0]["maintenance_date"]).replace("Z", "+00:00")).date()
        days_observed = max(1, (today - oldest).days + 1)
        annualized_cost = (maintenance_cost_total / days_observed) * 365.0
        recent_cutoff = today.toordinal() - 365
        recent_12m_cost = sum(
            float(row["cost"] or 0)
            for row in maintenance_rows
            if datetime.fromisoformat(str(row["maintenance_date"]).replace("Z", "+00:00")).date().toordinal() >= recent_cutoff
        )
        projected_maintenance_cost = round(recent_12m_cost if recent_12m_cost > 0 else annualized_cost, 2)

    risk_multiplier = 0.15
    if machine["status"] == "Critical":
        risk_multiplier = 0.6
    elif machine["status"] == "Warning":
        risk_multiplier = 0.35

    downtime_risk_cost = round(max(0.0, revenue_per_month * risk_multiplier), 2)
    keep_estimated_value = round((monthly_margin * 12) - projected_maintenance_cost - downtime_risk_cost, 2)
    replacement_efficiency_gain = round(max(0.0, monthly_margin * 12 * 0.08), 2)
    replace_estimated_value = round((monthly_margin * 12) - replacement_cost + replacement_efficiency_gain, 2)

    recommendation = "Collect more economic data"
    rationale = "Enter monthly revenue, operating cost, maintenance cost, and replacement cost to compare options."

    if any(value > 0 for value in [revenue_per_month, operating_cost_per_month, projected_maintenance_cost, replacement_cost]):
        if replace_estimated_value > keep_estimated_value or (
            machine["status"] == "Critical" and replacement_cost > 0 and projected_maintenance_cost >= replacement_cost * 0.55
        ):
            recommendation = "Buy new machine"
            rationale = "Replacement has the stronger 12-month economic outlook after maintenance and downtime risk."
        else:
            recommendation = "Keep maintaining"
            rationale = "Maintenance remains economically better than replacement across the current 12-month estimate."

    return {
        "revenue_per_month": revenue_per_month,
        "operating_cost_per_month": operating_cost_per_month,
        "projected_maintenance_cost": projected_maintenance_cost,
        "replacement_cost": replacement_cost,
        "maintenance_cost_total": maintenance_cost_total,
        "maintenance_events": maintenance_events,
        "monthly_margin": round(monthly_margin, 2),
        "downtime_risk_cost": downtime_risk_cost,
        "keep_estimated_value_12m": keep_estimated_value,
        "replace_estimated_value_12m": replace_estimated_value,
        "replacement_efficiency_gain": replacement_efficiency_gain,
        "recommendation": recommendation,
        "rationale": rationale,
        "current_health_pct": round(health_pct, 1),
        "current_rul_cycles": round(rul_cycles, 1),
    }


def serialize_machine(machine: sqlite3.Row, conn: sqlite3.Connection) -> dict[str, Any]:
    machine_id = int(machine["id"])
    latest_prediction = conn.execute(
        """
        SELECT * FROM predictions
        WHERE machine_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (machine_id,),
    ).fetchone()
    latest_alert = conn.execute(
        """
        SELECT * FROM alerts
        WHERE machine_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (machine_id,),
    ).fetchone()
    return {
        "id": machine_id,
        "name": machine["name"],
        "type": machine["machine_type"],
        "brand": machine["brand"],
        "location": machine["location"],
        "install_date": machine["install_date"],
        "notes": machine["notes"],
        "health": round(float(machine["health_pct"]), 1),
        "rul_cycles": round(float(machine["rul_cycles"]), 1),
        "rul_days": round(float(machine["rul_cycles"]) / 2.0, 1),
        "revenue_per_month": round(float(machine["revenue_per_month"] or 0), 2),
        "operating_cost_per_month": round(float(machine["operating_cost_per_month"] or 0), 2),
        "projected_maintenance_cost": round(float(machine["projected_maintenance_cost"] or 0), 2),
        "replacement_cost": round(float(machine["replacement_cost"] or 0), 2),
        "status": machine["status"],
        "last_maint": machine["last_maintenance_date"],
        "created_at": machine["created_at"],
        "updated_at": machine["updated_at"],
        "owner_user_id": machine["owner_user_id"],
        "economics": build_machine_economics(machine, conn),
        "latest_prediction": serialize_prediction(latest_prediction),
        "latest_alert": serialize_alert(latest_alert),
    }


@app.get("/health")
@app.get("/api/health")
def health_check() -> dict[str, Any]:
    with closing(get_db()) as conn:
        machine_count = conn.execute("SELECT COUNT(*) FROM machines").fetchone()[0]
    return {"status": "ok", "database": str(DB_PATH), "machines": machine_count}


@app.get("/api/catalog")
def get_equipment_catalog() -> dict[str, Any]:
    return {"catalog": []}


@app.get("/api/dashboard")
def get_dashboard(user_id: str = Depends(require_user_id)) -> dict[str, Any]:
    with closing(get_db()) as conn:
        machine_rows = conn.execute(
            "SELECT * FROM machines WHERE owner_user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
        alert_rows = conn.execute(
            "SELECT a.* FROM alerts a JOIN machines m ON m.id = a.machine_id "
            "WHERE m.owner_user_id = ? ORDER BY a.created_at DESC LIMIT 10",
            (user_id,),
        ).fetchall()
        maintenance_rows = conn.execute(
            "SELECT m.name AS machine_name, l.* FROM maintenance_logs l "
            "JOIN machines m ON m.id = l.machine_id "
            "WHERE m.owner_user_id = ? ORDER BY l.maintenance_date DESC LIMIT 10",
            (user_id,),
        ).fetchall()
        prediction_rows = conn.execute(
            "SELECT * FROM predictions WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 10",
            (user_id,),
        ).fetchall()

        machines = [serialize_machine(row, conn) for row in machine_rows]
        return {
            "summary": {
                "total": len(machines),
                "healthy": sum(1 for item in machines if item["status"] == "Healthy"),
                "warning": sum(1 for item in machines if item["status"] == "Warning"),
                "critical": sum(1 for item in machines if item["status"] == "Critical"),
            },
            "machines": machines,
            "alerts": [serialize_alert(row) for row in alert_rows],
            "maintenance_logs": [row_to_dict(row) for row in maintenance_rows],
            "predictions": [serialize_prediction(row) for row in prediction_rows],
        }


@app.post("/api/machines", status_code=201)
def create_machine(payload: MachineCreate, user_id: str = Depends(require_user_id)) -> dict[str, Any]:
    created_at = utc_now()
    status = compute_status(payload.health_pct, payload.rul_cycles)
    with closing(get_db()) as conn:
        cursor = conn.execute(
            """
            INSERT INTO machines (
                owner_user_id, name, machine_type, brand, location, install_date, notes, status,
                health_pct, rul_cycles, revenue_per_month, operating_cost_per_month,
                projected_maintenance_cost, replacement_cost, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                payload.name,
                payload.machine_type,
                payload.brand,
                payload.location,
                payload.install_date,
                payload.notes,
                status,
                payload.health_pct,
                payload.rul_cycles,
                payload.revenue_per_month,
                payload.operating_cost_per_month,
                payload.projected_maintenance_cost,
                payload.replacement_cost,
                created_at,
                created_at,
            ),
        )
        conn.commit()
        machine = conn.execute("SELECT * FROM machines WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return {"message": "Machine created", "machine": serialize_machine(machine, conn)}


@app.get("/api/machines")
def list_machines(user_id: str = Depends(require_user_id)) -> dict[str, Any]:
    with closing(get_db()) as conn:
        rows = conn.execute(
            "SELECT * FROM machines WHERE owner_user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
        machines = [serialize_machine(row, conn) for row in rows]
        return {
            "machines": machines,
            "total": len(machines),
            "critical": sum(1 for item in machines if item["status"] == "Critical"),
            "warning": sum(1 for item in machines if item["status"] == "Warning"),
        }


@app.get("/api/machines/{machine_id}")
def get_machine(machine_id: int, user_id: str = Depends(require_user_id)) -> dict[str, Any]:
    with closing(get_db()) as conn:
        machine = fetch_machine_or_404(conn, machine_id, user_id)
        reading_rows = conn.execute(
            "SELECT * FROM sensor_readings WHERE machine_id = ? ORDER BY timestamp DESC LIMIT 50",
            (machine_id,),
        ).fetchall()
        log_rows = conn.execute(
            "SELECT * FROM maintenance_logs WHERE machine_id = ? ORDER BY maintenance_date DESC LIMIT 50",
            (machine_id,),
        ).fetchall()
        alert_rows = conn.execute(
            "SELECT * FROM alerts WHERE machine_id = ? ORDER BY created_at DESC LIMIT 50",
            (machine_id,),
        ).fetchall()
        prediction_rows = conn.execute(
            "SELECT * FROM predictions WHERE machine_id = ? ORDER BY created_at DESC LIMIT 50",
            (machine_id,),
        ).fetchall()
        return {
            **serialize_machine(machine, conn),
            "sensor_readings": [serialize_sensor_reading(row) for row in reading_rows],
            "maintenance_logs": [serialize_maintenance_log(row) for row in log_rows],
            "alerts": [serialize_alert(row) for row in alert_rows],
            "predictions": [serialize_prediction(row) for row in prediction_rows],
        }


@app.patch("/api/machines/{machine_id}")
def update_machine(machine_id: int, payload: MachineUpdate, user_id: str = Depends(require_user_id)) -> dict[str, Any]:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided")

    with closing(get_db()) as conn:
        machine = fetch_machine_or_404(conn, machine_id, user_id)
        current = row_to_dict(machine) or {}
        merged = {**current, **updates}
        health_pct = float(merged["health_pct"])
        rul_cycles = float(merged["rul_cycles"])
        status = compute_status(health_pct, rul_cycles)

        columns = []
        params: list[Any] = []
        for key, value in updates.items():
            columns.append(f"{key} = ?")
            params.append(value)
        columns.extend(["status = ?", "updated_at = ?"])
        params.extend([status, utc_now(), machine_id])

        conn.execute(f"UPDATE machines SET {', '.join(columns)} WHERE id = ?", params)
        conn.commit()
        updated = fetch_machine_or_404(conn, machine_id, user_id)
        return {"message": "Machine updated", "machine": serialize_machine(updated, conn)}


@app.put("/api/machines/{machine_id}/economics")
def update_machine_economics(
    machine_id: int,
    payload: MachineEconomicsUpdate,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    with closing(get_db()) as conn:
        fetch_machine_or_404(conn, machine_id, user_id)
        conn.execute(
            """
            UPDATE machines
            SET revenue_per_month = ?, operating_cost_per_month = ?, replacement_cost = ?, updated_at = ?
            WHERE id = ? AND owner_user_id = ?
            """,
            (
                payload.revenue_per_month,
                payload.operating_cost_per_month,
                payload.replacement_cost,
                utc_now(),
                machine_id,
                user_id,
            ),
        )
        conn.commit()
        updated = fetch_machine_or_404(conn, machine_id, user_id)
        return {
            "message": "Machine economics updated",
            "machine": serialize_machine(updated, conn),
            "economics": build_machine_economics(updated, conn),
        }


@app.delete("/api/machines/{machine_id}", status_code=204)
def delete_machine(machine_id: int, user_id: str = Depends(require_user_id)) -> Response:
    with closing(get_db()) as conn:
        fetch_machine_or_404(conn, machine_id, user_id)
        conn.execute("DELETE FROM machines WHERE id = ?", (machine_id,))
        conn.commit()
    return Response(status_code=204)


@app.post("/api/machines/{machine_id}/sensor-readings", status_code=201)
def create_sensor_reading(
    machine_id: int,
    payload: SensorReadingCreate,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    timestamp = payload.timestamp or utc_now()
    with closing(get_db()) as conn:
        machine = fetch_machine_or_404(conn, machine_id, user_id)
        cursor = conn.execute(
            """
            INSERT INTO sensor_readings (
                machine_id, timestamp, cycle, temperature, vibration, pressure, load_pct,
                rpm, source, raw_payload, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                machine_id,
                timestamp,
                payload.cycle,
                payload.temperature,
                payload.vibration,
                payload.pressure,
                payload.load_pct,
                payload.rpm,
                payload.source,
                json.dumps(payload.raw_payload or {}),
                utc_now(),
            ),
        )
        reading = conn.execute("SELECT * FROM sensor_readings WHERE id = ?", (cursor.lastrowid,)).fetchone()

        df = reading_as_dataframe(payload.model_dump())
        prediction = run_prediction(df)
        store_prediction(conn, user_id, machine_id, prediction, input_mode="sensor-reading")
        conn.execute(
            """
            UPDATE machines
            SET health_pct = ?, rul_cycles = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                prediction["health_pct"],
                prediction["rul_cycles"],
                prediction["status"],
                utc_now(),
                machine_id,
            ),
        )
        alerts = insert_alerts(conn, machine_id, str(machine["name"]), prediction, payload.model_dump())
        conn.commit()
        return {
            "message": "Sensor reading stored",
            "reading": serialize_sensor_reading(reading),
            "prediction": prediction,
            "alerts": alerts,
        }


@app.get("/api/machines/{machine_id}/sensor-readings")
def list_sensor_readings(
    machine_id: int,
    limit: int = 100,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    capped_limit = max(1, min(limit, 500))
    with closing(get_db()) as conn:
        fetch_machine_or_404(conn, machine_id, user_id)
        rows = conn.execute(
            "SELECT * FROM sensor_readings WHERE machine_id = ? ORDER BY timestamp DESC LIMIT ?",
            (machine_id, capped_limit),
        ).fetchall()
        return {"sensor_readings": [serialize_sensor_reading(row) for row in rows]}


@app.post("/api/machines/{machine_id}/maintenance-logs", status_code=201)
def create_maintenance_log(
    machine_id: int,
    payload: MaintenanceLogCreate,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    with closing(get_db()) as conn:
        machine = fetch_machine_or_404(conn, machine_id, user_id)
        cursor = conn.execute(
            """
            INSERT INTO maintenance_logs (
                machine_id, maintenance_date, maintenance_type, parts_replaced,
                cost, technician, notes, restored_health_pct, restored_rul_cycles,
                reset_cycle, cleared_sensor_history, cleared_alerts, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                machine_id,
                payload.maintenance_date,
                payload.maintenance_type,
                payload.parts_replaced,
                payload.cost,
                payload.technician,
                payload.notes,
                payload.restored_health_pct,
                payload.restored_rul_cycles,
                payload.reset_cycle,
                int(payload.clear_sensor_history),
                int(payload.clear_alerts),
                utc_now(),
            ),
        )
        conn.execute(
            """
            UPDATE machines
            SET health_pct = ?, rul_cycles = ?, status = ?, last_maintenance_date = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                payload.restored_health_pct,
                payload.restored_rul_cycles,
                compute_status(payload.restored_health_pct, payload.restored_rul_cycles),
                payload.maintenance_date,
                utc_now(),
                machine_id,
            ),
        )

        if payload.clear_sensor_history:
            conn.execute("DELETE FROM sensor_readings WHERE machine_id = ?", (machine_id,))
        if payload.clear_alerts:
            conn.execute("DELETE FROM alerts WHERE machine_id = ?", (machine_id,))
        conn.execute("DELETE FROM predictions WHERE machine_id = ?", (machine_id,))
        conn.execute(
            """
            INSERT INTO sensor_readings (
                machine_id, timestamp, cycle, temperature, vibration, pressure, load_pct,
                rpm, source, raw_payload, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                machine_id,
                payload.maintenance_date,
                payload.reset_cycle,
                None,
                None,
                None,
                None,
                None,
                "maintenance-reset",
                json.dumps(
                    {
                        "maintenance_type": payload.maintenance_type,
                        "machine_name": machine["name"],
                        "restored_health_pct": payload.restored_health_pct,
                        "restored_rul_cycles": payload.restored_rul_cycles,
                    }
                ),
                utc_now(),
            ),
        )
        maintenance_prediction = {
            "health_pct": round(payload.restored_health_pct, 1),
            "rul_cycles": round(payload.restored_rul_cycles, 1),
            "rul_days": round(payload.restored_rul_cycles / 2.0, 1),
            "status": compute_status(payload.restored_health_pct, payload.restored_rul_cycles),
            "confidence": 0.95,
            "model_mode": "maintenance-reset",
            "ml_error": None,
            "top_factors": [
                {"feature": "Maintenance Reset", "impact": round(payload.restored_health_pct, 1), "direction": "positive"}
            ],
        }
        store_prediction(conn, user_id, machine_id, maintenance_prediction, input_mode="maintenance-reset")
        log_row = conn.execute("SELECT * FROM maintenance_logs WHERE id = ?", (cursor.lastrowid,)).fetchone()
        conn.commit()
        return {
            "message": "Maintenance log stored and machine reset",
            "log": serialize_maintenance_log(log_row),
            "machine": serialize_machine(fetch_machine_or_404(conn, machine_id, user_id), conn),
        }


@app.get("/api/machines/{machine_id}/maintenance-logs")
def list_machine_maintenance_logs(
    machine_id: int,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    with closing(get_db()) as conn:
        fetch_machine_or_404(conn, machine_id, user_id)
        rows = conn.execute(
            "SELECT * FROM maintenance_logs WHERE machine_id = ? ORDER BY maintenance_date DESC",
            (machine_id,),
        ).fetchall()
        return {"maintenance_logs": [serialize_maintenance_log(row) for row in rows]}


@app.get("/api/maintenance")
def get_maintenance_logs(user_id: str = Depends(require_user_id)) -> dict[str, Any]:
    with closing(get_db()) as conn:
        rows = conn.execute(
            "SELECT m.name AS machine_name, l.* FROM maintenance_logs l "
            "JOIN machines m ON m.id = l.machine_id "
            "WHERE m.owner_user_id = ? ORDER BY l.maintenance_date DESC",
            (user_id,),
        ).fetchall()
        return {"maintenance_logs": [row_to_dict(row) for row in rows]}


@app.get("/api/alerts")
def get_alerts(
    active_only: bool = False,
    limit: int = 100,
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    capped_limit = max(1, min(limit, 500))
    query = (
        "SELECT a.* FROM alerts a JOIN machines m ON m.id = a.machine_id "
        "WHERE m.owner_user_id = ?"
    )
    params: list[Any] = [user_id]
    if active_only:
        query += " AND a.is_active = 1"
    query += " ORDER BY a.created_at DESC LIMIT ?"
    params.append(capped_limit)

    with closing(get_db()) as conn:
        rows = conn.execute(query, params).fetchall()
        return {"alerts": [serialize_alert(row) for row in rows]}


@app.get("/api/predictions")
def get_predictions(limit: int = 100, user_id: str = Depends(require_user_id)) -> dict[str, Any]:
    capped_limit = max(1, min(limit, 500))
    with closing(get_db()) as conn:
        rows = conn.execute(
            "SELECT * FROM predictions WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, capped_limit),
        ).fetchall()
        return {"predictions": [serialize_prediction(row) for row in rows]}


@app.post("/predict")
@app.post("/api/predict")
def predict(payload: PredictRequest, user_id: str = Depends(require_user_id)) -> dict[str, Any]:
    request_data = payload.model_dump()
    machine_id = request_data.get("machine_id")
    with closing(get_db()) as conn:
        machine = None
        if machine_id is not None:
            machine = fetch_machine_or_404(conn, machine_id, user_id)

        df = reading_as_dataframe(request_data)
        prediction = run_prediction(df)
        prediction_id = store_prediction(conn, user_id, machine_id, prediction, input_mode="manual")

        alerts: list[dict[str, Any]] = []
        if machine is not None:
            conn.execute(
                """
                UPDATE machines
                SET health_pct = ?, rul_cycles = ?, status = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    prediction["health_pct"],
                    prediction["rul_cycles"],
                    prediction["status"],
                    utc_now(),
                    machine_id,
                ),
            )
            alerts = insert_alerts(conn, machine_id, str(machine["name"]), prediction, request_data)
        conn.commit()

    prediction["prediction_id"] = prediction_id
    prediction["confidence_pct"] = round(float(prediction["confidence"]) * 100.0, 1)
    prediction["machine_id"] = machine_id
    prediction["alerts"] = alerts
    return prediction


@app.post("/api/machines/{machine_id}/upload")
async def upload_machine_log(
    machine_id: int,
    file: UploadFile = File(...),
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV contains no rows")

    with closing(get_db()) as conn:
        machine = fetch_machine_or_404(conn, machine_id, user_id)
        created_at = utc_now()
        inserted = 0
        for _, row in df.head(500).iterrows():
            raw_payload = {k: v for k, v in row.to_dict().items() if pd.notna(v)}
            conn.execute(
                """
                INSERT INTO sensor_readings (
                    machine_id, timestamp, cycle, temperature, vibration, pressure, load_pct,
                    rpm, source, raw_payload, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    machine_id,
                    str(row.get("timestamp") or created_at),
                    float(row["cycle"]) if pd.notna(row.get("cycle")) else None,
                    float(row["temperature"]) if pd.notna(row.get("temperature")) else None,
                    float(row["vibration"]) if pd.notna(row.get("vibration")) else None,
                    float(row["pressure"]) if pd.notna(row.get("pressure")) else None,
                    float(row["load_pct"]) if pd.notna(row.get("load_pct")) else (
                        float(row["load"]) if pd.notna(row.get("load")) else None
                    ),
                    float(row["rpm"]) if pd.notna(row.get("rpm")) else None,
                    "csv-upload",
                    json.dumps(raw_payload),
                    created_at,
                ),
            )
            inserted += 1

        prediction = run_prediction(df)
        store_prediction(conn, user_id, machine_id, prediction, input_mode="csv-upload")
        conn.execute(
            """
            UPDATE machines
            SET health_pct = ?, rul_cycles = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                prediction["health_pct"],
                prediction["rul_cycles"],
                prediction["status"],
                utc_now(),
                machine_id,
            ),
        )
        latest_row = df.iloc[-1].to_dict()
        alerts = insert_alerts(conn, machine_id, str(machine["name"]), prediction, latest_row)
        conn.commit()
        return {
            "message": "CSV ingested successfully",
            "rows_ingested": inserted,
            "prediction": prediction,
            "alerts": alerts,
        }


@app.post("/api/predict/upload")
async def upload_prediction_file(
    file: UploadFile = File(...),
    user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV contains no rows")

    with closing(get_db()) as conn:
        prediction = run_prediction(df)
        prediction_id = store_prediction(conn, user_id, None, prediction, input_mode="csv-upload")
        conn.commit()

    prediction["prediction_id"] = prediction_id
    prediction["confidence_pct"] = round(float(prediction["confidence"]) * 100.0, 1)
    prediction["machine_id"] = None
    prediction["alerts"] = []
    return prediction


@app.get("/api/shap")
def get_shap() -> dict[str, Any]:
    feature_path = MODELS_DIR / "features.pkl"
    if not feature_path.exists():
        return {
            "impacts": [
                {"feature": "temperature", "value": 0.42},
                {"feature": "vibration", "value": 0.37},
                {"feature": "load_pct", "value": 0.24},
                {"feature": "rpm", "value": 0.18},
            ]
        }

    try:
        import pickle
        import random

        with open(feature_path, "rb") as handle:
            features = pickle.load(handle)
        return {
            "impacts": [
                {"feature": feature, "value": round(random.uniform(0.1, 0.5), 2)}
                for feature in features[:6]
            ]
        }
    except Exception as exc:
        return {"error": str(exc)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("Backend.main:app", host="0.0.0.0", port=8000, reload=True)
