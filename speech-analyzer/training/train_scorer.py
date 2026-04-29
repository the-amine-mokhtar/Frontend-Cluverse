"""Train and persist the speech scoring model from CSV data."""

from __future__ import annotations

import logging
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

FEATURES = [
    "speech_rate",
    "pitch_variation",
    "filler_rate",
    "energy_level",
    "pause_count",
]
TARGET = "score"


def _load_training_data(data_dir: Path) -> pd.DataFrame:
    """Load and concatenate all CSV files from training data directory."""

    csv_files = sorted(data_dir.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV file found in {data_dir}")

    frames = [pd.read_csv(csv_path) for csv_path in csv_files]
    dataset = pd.concat(frames, ignore_index=True)
    missing_columns = [column for column in FEATURES + [TARGET] if column not in dataset.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns in dataset: {missing_columns}")

    return dataset


def main() -> None:
    """Run model training, evaluation, and persistence."""

    project_root = Path(__file__).resolve().parents[1]
    data_dir = project_root / "training" / "data"
    model_output = project_root / "app" / "models" / "scorer.pkl"

    dataset = _load_training_data(data_dir)
    x = dataset[FEATURES]
    y = dataset[TARGET]

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=42,
    )

    preprocessor = ColumnTransformer(
        transformers=[("scale", StandardScaler(), FEATURES)],
        remainder="drop",
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "regressor",
                RandomForestRegressor(
                    n_estimators=300,
                    random_state=42,
                    max_depth=12,
                    min_samples_split=4,
                ),
            ),
        ]
    )

    pipeline.fit(x_train, y_train)
    predictions = pipeline.predict(x_test)

    mae = mean_absolute_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)

    logger.info("Training completed", extra={"mae": round(float(mae), 4), "r2": round(float(r2), 4)})

    model_output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, model_output)
    logger.info("Model saved", extra={"path": str(model_output)})


if __name__ == "__main__":
    main()
