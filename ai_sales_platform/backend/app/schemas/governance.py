from pydantic import BaseModel


class ModelGovernanceResponse(BaseModel):
    model_version: str
    feature_count: int
    features: list[str]
    training_data_window: str
    last_retrained_date: str
    validation_smape: float | None
    drift_indicator: float | None
    notes: str
