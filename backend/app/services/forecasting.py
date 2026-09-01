"""
Multi-model demand forecasting.

For a given SKU's sales history, trains XGBoost, Prophet, and a small LSTM,
backtests each on a held-out tail of the series, and picks the model with
the lowest MAPE. Persists all three results (tagging the winner) so the
frontend can show "why this model won" later in the explainability phase.
"""
from datetime import timedelta

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_percentage_error
from sqlalchemy.orm import Session

from app.models import SalesRecord, ForecastResult, SKU

HOLDOUT_DAYS = 14
FORECAST_HORIZON = 14


def _get_series(db: Session, sku: SKU) -> pd.DataFrame:
    records = (
        db.query(SalesRecord)
        .filter(SalesRecord.sku_id == sku.id)
        .order_by(SalesRecord.date)
        .all()
    )
    df = pd.DataFrame([{"date": r.date, "units_sold": r.units_sold} for r in records])
    return df


def _make_lag_features(df: pd.DataFrame, n_lags: int = 7) -> pd.DataFrame:
    out = df.copy()
    for lag in range(1, n_lags + 1):
        out[f"lag_{lag}"] = out["units_sold"].shift(lag)
    out["dow"] = pd.to_datetime(out["date"]).dt.dayofweek
    return out.dropna()


def _forecast_xgboost(train: pd.DataFrame, horizon: int) -> np.ndarray:
    import xgboost as xgb

    feat = _make_lag_features(train)
    X = feat.drop(columns=["date", "units_sold"])
    y = feat["units_sold"]
    model = xgb.XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.05)
    model.fit(X, y)

    history = list(train["units_sold"].values[-7:])
    preds = []
    last_date = pd.to_datetime(train["date"].iloc[-1])
    for step in range(horizon):
        dow = (last_date + timedelta(days=step + 1)).dayofweek
        row = {f"lag_{i+1}": history[-(i + 1)] for i in range(7)}
        row["dow"] = dow
        pred = model.predict(pd.DataFrame([row])[X.columns])[0]
        preds.append(max(0, pred))
        history.append(pred)
    return np.array(preds)


def _forecast_prophet(train: pd.DataFrame, horizon: int) -> np.ndarray:
    from prophet import Prophet

    p_df = train.rename(columns={"date": "ds", "units_sold": "y"})
    model = Prophet(daily_seasonality=False, weekly_seasonality=True, yearly_seasonality=False)
    model.fit(p_df)
    future = model.make_future_dataframe(periods=horizon)
    forecast = model.predict(future)
    return forecast["yhat"].tail(horizon).clip(lower=0).values


def _forecast_lstm(train: pd.DataFrame, horizon: int) -> np.ndarray:
    import torch
    import torch.nn as nn

    series = train["units_sold"].values.astype("float32")
    mean, std = series.mean(), series.std() + 1e-6
    norm = (series - mean) / std

    window = 14
    if len(norm) <= window:
        # not enough data for LSTM — fall back to naive mean
        return np.full(horizon, series.mean())

    X, y = [], []
    for i in range(len(norm) - window):
        X.append(norm[i:i + window])
        y.append(norm[i + window])
    X = torch.tensor(np.array(X)).unsqueeze(-1)
    y = torch.tensor(np.array(y)).unsqueeze(-1)

    class SmallLSTM(nn.Module):
        def __init__(self):
            super().__init__()
            self.lstm = nn.LSTM(1, 16, batch_first=True)
            self.fc = nn.Linear(16, 1)

        def forward(self, x):
            out, _ = self.lstm(x)
            return self.fc(out[:, -1, :])

    model = SmallLSTM()
    opt = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = nn.MSELoss()
    for _ in range(30):
        opt.zero_grad()
        pred = model(X)
        loss = loss_fn(pred, y)
        loss.backward()
        opt.step()

    seq = list(norm[-window:])
    preds = []
    for _ in range(horizon):
        x = torch.tensor(np.array(seq[-window:], dtype="float32")).reshape(1, window, 1)
        with torch.no_grad():
            p = model(x).item()
        preds.append(p)
        seq.append(p)
    preds = np.array(preds) * std + mean
    return np.clip(preds, 0, None)


MODELS = {
    "xgboost": _forecast_xgboost,
    "prophet": _forecast_prophet,
    "lstm": _forecast_lstm,
}


def run_forecast_for_sku(db: Session, sku: SKU) -> str:
    """Trains all models, backtests, persists results, returns the winning model name."""
    df = _get_series(db, sku)
    if len(df) < HOLDOUT_DAYS + 21:
        raise ValueError(f"Not enough history for {sku.sku_code} to backtest reliably")

    train = df.iloc[:-HOLDOUT_DAYS].reset_index(drop=True)
    holdout = df.iloc[-HOLDOUT_DAYS:].reset_index(drop=True)

    scores = {}
    forecasts = {}
    for name, fn in MODELS.items():
        try:
            preds = fn(train, HOLDOUT_DAYS)
            mape = mean_absolute_percentage_error(
                holdout["units_sold"].clip(lower=0.01), np.clip(preds, 0.01, None)
            )
            scores[name] = mape
            forecasts[name] = preds
        except Exception as e:
            print(f"  {name} failed for {sku.sku_code}: {e}")

    if not scores:
        raise RuntimeError(f"All models failed for {sku.sku_code}")

    best_model = min(scores, key=scores.get)

    # retrain best model on full history for the actual future forecast
    full_preds = MODELS[best_model](df, FORECAST_HORIZON)
    last_date = pd.to_datetime(df["date"].iloc[-1])

    for name, mape in scores.items():
        is_best = name == best_model
        db.add(ForecastResult(
            sku_id=sku.id,
            date=(last_date + timedelta(days=1)).date(),
            model_name=name,
            predicted_units=float(full_preds[0]) if is_best else float(forecasts[name][0]),
            mape=float(mape),
            is_best_model=int(is_best),
        ))
    db.commit()
    print(f"{sku.sku_code}: best model = {best_model} (MAPE {scores[best_model]:.3f})")
    return best_model


def run_forecast_all(db: Session):
    skus = db.query(SKU).all()
    for sku in skus:
        try:
            run_forecast_for_sku(db, sku)
        except ValueError as e:
            print(f"Skipping {sku.sku_code}: {e}")
