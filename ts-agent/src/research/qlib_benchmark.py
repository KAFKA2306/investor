import qlib
from qlib.constant import REG_CN
from qlib.utils import init_instance_by_config
from qlib.workflow import R
import argparse
import os


def run_benchmark(csv_path: str):
    # Initialize Qlib
    qlib.init(region=REG_CN)  # Using CN region as a placeholder for stock configs

    handler_config = {
        "class": "RepoDataHandler",
        "module_path": "ts-agent.src.research.qlib_handler",
        "kwargs": {
            "csv_path": csv_path,
            "start_time": "2023-01-01",
            "end_time": "2025-12-31",
            "fit_start_time": "2023-01-01",
            "fit_end_time": "2024-12-31",
            "instruments": "all",
        },
    }

    task_config = {
        "model": {
            "class": "LGBModel",
            "module_path": "qlib.contrib.model.gbdt",
            "kwargs": {
                "loss": "mse",
                "colsample_bytree": 0.8879,
                "learning_rate": 0.2,
                "subsample": 0.8789,
                "lambda_l1": 205.6999,
                "lambda_l2": 580.9,
                "max_depth": 8,
                "num_leaves": 210,
                "num_threads": 20,
            },
        },
        "dataset": {
            "class": "DatasetH",
            "module_path": "qlib.data.dataset",
            "kwargs": {
                "handler": handler_config,
                "segments": {
                    "train": ("2023-01-01", "2024-12-31"),
                    "valid": ("2025-01-01", "2025-06-30"),
                    "test": ("2025-07-01", "2025-12-31"),
                },
            },
        },
    }

    # Mark as experiment
    with R.start(experiment_name="repo_qlib_benchmark"):
        model = init_instance_by_config(task_config["model"])
        dataset = init_instance_by_config(task_config["dataset"])
        model.fit(dataset)
        R.save_objects(trained_model=model)

        # In a real scenario, we would add backtest and analysis here
        print("Qlib benchmark completed successfully!✨")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=str, required=True)
    args = parser.parse_args()

    if not os.path.exists(args.csv):
        print(
            f"Skipping Qlib benchmark: {args.csv} not found. Please export data from TS first."
        )
    else:
        run_benchmark(args.csv)
