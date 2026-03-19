import pickle
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_squared_error

BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

# NASA CMAPSS FD001 column mapping
COLUMNS = ["id", "cycle", "setting1", "setting2", "setting3"] + [f"s{i}" for i in range(1, 22)]
TRAIN_FEATURES = ["setting1", "setting2", "setting3"] + [f"s{i}" for i in range(1, 22)]


def load_data(file_path: Path) -> pd.DataFrame:
    print(f"Loading data from {file_path}...")
    df = pd.read_csv(file_path, sep=r"\s+", header=None, names=COLUMNS)

    rul = pd.DataFrame(df.groupby("id")["cycle"].max()).reset_index()
    rul.columns = ["id", "max_cycle"]
    df = df.merge(rul, on=["id"], how="left")
    df["RUL"] = df["max_cycle"] - df["cycle"]
    df.drop("max_cycle", axis=1, inplace=True)
    return df


def train() -> None:
    data_path = BASE_DIR / "Backend" / "train_FD001.txt"
    if not data_path.exists():
        print(f"ERROR: Dataset not found at {data_path}")
        return

    df = load_data(data_path)
    x_train = df[TRAIN_FEATURES]
    y_train = df["RUL"]

    print("Training XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
        objective="reg:squarederror",
    )
    model.fit(x_train, y_train)

    preds = model.predict(x_train)
    print("Train RMSE:", float(np.sqrt(mean_squared_error(y_train, preds))))

    with open(MODELS_DIR / "model_rul.pkl", "wb") as f:
        pickle.dump(model, f)

    with open(MODELS_DIR / "features.pkl", "wb") as f:
        pickle.dump(TRAIN_FEATURES, f)

    print(f"Model successfully trained and saved to {MODELS_DIR / 'model_rul.pkl'}")


def _coerce_numeric(df: pd.DataFrame, column_names: list[str]) -> float:
    for name in column_names:
        if name in df.columns:
            series = pd.to_numeric(df[name], errors="coerce").dropna()
            if not series.empty:
                return float(series.mean())
    return 0.0


def _build_feature_row(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    x_input = pd.DataFrame([{feature: 0.0 for feature in features}])

    # Use direct NASA columns if they already exist in the upload.
    for feature in features:
        if feature in df.columns:
            x_input.at[0, feature] = _coerce_numeric(df, [feature])

    # Generic UI columns mapped into NASA-like ranges.
    temperature = _coerce_numeric(df, ["temperature", "temp", "s14"])
    vibration = _coerce_numeric(df, ["vibration", "vibe", "s11"])
    rpm = _coerce_numeric(df, ["rpm", "speed"])
    pressure = _coerce_numeric(df, ["pressure", "press", "s7"])
    load = _coerce_numeric(df, ["load", "load_pct", "torque"])
    cycle = _coerce_numeric(df, ["cycle"])

    if "s2" in x_input.columns and temperature:
        x_input.at[0, "s2"] = 570.0 + temperature
    if "s3" in x_input.columns and vibration:
        x_input.at[0, "s3"] = 1540.0 + (vibration * 100.0)
    if "s7" in x_input.columns and pressure:
        x_input.at[0, "s7"] = 550.0 + (pressure * 2.0)
    if "s11" in x_input.columns:
        if rpm:
            x_input.at[0, "s11"] = 470.0 + (rpm / 10.0)
        elif vibration:
            x_input.at[0, "s11"] = 470.0 + (vibration * 50.0)
    if "s4" in x_input.columns and load:
        x_input.at[0, "s4"] = 1400.0 + (load * 2.5)
    if "setting1" in x_input.columns and cycle:
        x_input.at[0, "setting1"] = cycle / 100.0

    return x_input.astype(float)


def predict_rul_from_df(df: pd.DataFrame) -> dict:
    model_path = MODELS_DIR / "model_rul.pkl"
    feat_path = MODELS_DIR / "features.pkl"
    if not model_path.exists() or not feat_path.exists():
        raise FileNotFoundError("Model not trained yet.")

    with open(model_path, "rb") as f:
        model = pickle.load(f)
    with open(feat_path, "rb") as f:
        features = pickle.load(f)

    x_input = _build_feature_row(df, features)
    predicted_rul = float(model.predict(x_input)[0])
    rul_cycles = max(0.0, min(predicted_rul, 250.0))
    health_pct = max(0.0, min(100.0, round((rul_cycles / 180.0) * 100.0, 1)))

    status = "Healthy"
    if health_pct < 35:
        status = "Critical"
    elif health_pct < 65:
        status = "Warning"

    temp_mean = _coerce_numeric(df, ["temperature", "temp", "s14"])
    vib_mean = _coerce_numeric(df, ["vibration", "vibe", "s11"])
    rpm_mean = _coerce_numeric(df, ["rpm", "speed"])

    top_factors = []
    if temp_mean:
        top_factors.append(
            {
                "feature": "Temperature",
                "impact": round(temp_mean, 2),
                "direction": "negative" if temp_mean > 80 else "positive",
            }
        )
    if vib_mean:
        top_factors.append(
            {
                "feature": "Vibration",
                "impact": round(vib_mean, 2),
                "direction": "negative" if vib_mean > 0.8 else "positive",
            }
        )
    if rpm_mean:
        top_factors.append(
            {
                "feature": "RPM",
                "impact": round(rpm_mean, 2),
                "direction": "negative" if rpm_mean > 1800 else "positive",
            }
        )
    if not top_factors:
        top_factors.append({"feature": "Sensor profile", "impact": 0.0, "direction": "positive"})

    return {
        "rul_cycles": round(rul_cycles, 1),
        "rul_days": round(rul_cycles / 2.0, 1),
        "health_pct": health_pct,
        "status": status,
        "maintenance_needed": health_pct < 40,
        "anomaly": health_pct < 35,
        "top_factors": top_factors,
        "usage_cycles": int(len(df)),
    }


if __name__ == "__main__":
    train()
