import requests
import pandas as pd
import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
data_path = os.path.join(script_dir, "..", "data", "processed", "cicids2017_features_reduced.csv")
labels_path = os.path.join(script_dir, "..", "data", "processed", "cicids2017_labels.csv")

X_test = pd.read_csv(data_path)
y_test = pd.read_csv(labels_path).squeeze()

attack_idx = y_test[y_test == 1].index[:3]
benign_idx = y_test[y_test == 0].index[:3]

for idx in list(attack_idx) + list(benign_idx):
    row = X_test.iloc[idx].to_dict()
    true_label = "ATTACK" if y_test.iloc[idx] == 1 else "BENIGN"

    response = requests.post(
        "http://127.0.0.1:8000/predict",
        json={"features": row, "explain": True}
    )
    result = response.json()

    print(f"True: {true_label:8s} | Predicted: {result['prediction']:8s} | Confidence: {result['attack_probability']:.4f}")
    if "explanation" in result:
        print("  Top features:")
        for item in result["explanation"]:
            print(f"    {item['feature']:35s} {item['shap_value']:+.4f}")
    else:
        print("  (no explanation returned)")
    print()