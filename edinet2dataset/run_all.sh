#!/bin/bash
set -e

cd /home/kafka/finance/investor/edinet2dataset

export EDINET_API_KEY=7809b80879f64e31914ae0a75f46ed2a
source .venv/bin/activate

echo "Construct EDINET-Corpus (Annual 2024-2025)"
python scripts/prepare_edinet_corpus.py --doc_type annual --start_date 2024-01-01 --end_date 2025-01-01

echo "Construct EDINET-Corpus (Quarterly 2019)"
bash edinet_corpus.sh

echo "Construct Accounting Fraud Detection Task"
python scripts/fraud_detection/prepare_fraud.py || echo "Warning: prepare_fraud.py failed"
python scripts/fraud_detection/prepare_nonfraud.py || echo "Warning: prepare_nonfraud.py failed"
python scripts/fraud_detection/prepare_dataset.py || echo "Warning: prepare_dataset.py failed"
python scripts/fraud_detection/analyze_fraud_explanation.py || echo "Warning: analyze_fraud_explanation.py failed"

echo "Construct Earnings Forecasting Task"
python scripts/earnings_forecast/prepare_dataset.py || echo "Warning: earnings_forecast/prepare_dataset.py failed"

echo "Construct Industry Prediction Task"
python scripts/industry_prediction/prepare_dataset.py || echo "Warning: industry_prediction/prepare_dataset.py failed"

echo "All tasks completed."
