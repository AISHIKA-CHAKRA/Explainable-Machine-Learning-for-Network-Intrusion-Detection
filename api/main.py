from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
import shap

app = FastAPI(title="Explainable Network Intrusion detection API")

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

try:
    model = joblib.load("../models/xgboost.pkl")
    scaler = joblib.load("../models/scaler.pkl")
    explainer = shap.TreeExplainer(model)
except Exception as e:
    print(f"Failed to load artifacts: {e}")
    model = None
    scaler = None
    explainer = None

FEATURE_COLUMNS = [
    'Destination Port', 'Flow Duration', 'Total Fwd Packets',
    'Total Length of Fwd Packets', 'Fwd Packet Length Max', 'Fwd Packet Length Min',
    'Fwd Packet Length Mean', 'Bwd Packet Length Max', 'Bwd Packet Length Min',
    'Flow Bytes/s', 'Flow Packets/s', 'Flow IAT Mean', 'Flow IAT Std',
    'Flow IAT Min', 'Fwd IAT Min', 'Bwd IAT Total', 'Bwd IAT Mean',
    'Bwd IAT Std', 'Bwd IAT Min', 'Fwd PSH Flags', 'Bwd PSH Flags',
    'Fwd URG Flags', 'Bwd URG Flags', 'Bwd Packets/s', 'Min Packet Length',
    'FIN Flag Count', 'RST Flag Count', 'PSH Flag Count', 'ACK Flag Count',
    'URG Flag Count', 'CWE Flag Count', 'Down/Up Ratio', 'Fwd Avg Bytes/Bulk',
    'Fwd Avg Packets/Bulk', 'Fwd Avg Bulk Rate', 'Bwd Avg Bytes/Bulk',
    'Bwd Avg Packets/Bulk', 'Bwd Avg Bulk Rate', 'Init_Win_bytes_forward',
    'Init_Win_bytes_backward', 'min_seg_size_forward', 'Active Mean',
    'Active Std', 'Active Max', 'Active Min', 'Idle Std'
]

class NetworkFlow(BaseModel):
    features: dict
    explain: bool = False

@app.get("/health")
def health():
    return {
        "model_loaded": model is not None,
        "scaler_loaded": scaler is not None
    }

@app.get("/")
def root():
    return {"message": "Network Intrusion Detection API is running"}

@app.post("/predict")
def predict(flow: NetworkFlow):
    if model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Model or scaler not loaded")

    missing = set(FEATURE_COLUMNS) - set(flow.features.keys())
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing features: {sorted(missing)}")

    row = pd.DataFrame([flow.features])[FEATURE_COLUMNS]
    scaled = scaler.transform(row)
    prediction = int(model.predict(scaled)[0])
    probability = float(model.predict_proba(scaled)[0][1])

    result = {
        "prediction": "ATTACK" if prediction == 1 else "BENIGN",
        "attack_probability": round(probability, 4)
    }

    if flow.explain:
        shap_vals = explainer.shap_values(scaled)[0]
        contributions = dict(zip(FEATURE_COLUMNS, shap_vals))
        top_features = sorted(contributions.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
        result["explanation"] = [
            {"feature": f, "shap_value": round(float(v), 4)} for f, v in top_features
        ]

    return result
X_TEST_FOR_DEMO = pd.read_csv("../data/processed/cicids2017_features_reduced.csv")

@app.get("/sample/{row_index}")
def get_sample(row_index: int):
    if row_index < 0 or row_index >= len(X_TEST_FOR_DEMO):
        return {"error": "Row index out of range"}
    return X_TEST_FOR_DEMO.iloc[row_index].to_dict()