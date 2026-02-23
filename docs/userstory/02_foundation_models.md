# User Stories: Time-Series Foundation Models

## Model Registry & Multi-Model Support
- **As a researcher**, I want a **unified Model Registry** (`models.json`) to manage various时系列基盤モデル (Chronos, TimesFM, Lag-Llama, MOIRAI), so that I can easily switch between or ensemble different prediction engines.
- **As a developer**, I want a standardized inference interface (`run_inference.py`), so that adding a new foundation model requires zero changes to the core agent logic.

## Zero-Shot Forecasting
- **As a data scientist**, I want to perform **zero-shot forecasting** on unseen tickers without retraining, leveraging the pre-trained knowledge of massive transformer models like TimesFM or MOIRAI.
- **As a performance engineer**, I want to compare the predictive accuracy of different models against historical data (backtesting), identifying the most reliable "foundation" for a specific market sector.
