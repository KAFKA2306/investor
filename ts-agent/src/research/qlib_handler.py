import pandas as pd
from qlib.data.handler import DataHandlerLP
import os


class RepoDataHandler(DataHandlerLP):
    def __init__(self, csv_path: str, **kwargs):
        self.csv_path = csv_path
        super().__init__(**kwargs)

    def _init_raw_df(self):
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"TS-side data not found at {self.csv_path}")

        df = pd.read_csv(self.csv_path)
        df["date"] = pd.to_datetime(df["date"])
        df.set_index(["date", "symbol"], inplace=True)
        df.sort_index(inplace=True)
        return df

    def _get_learn_processors(self):
        return [
            {
                "class": "RobustZScoreNorm",
                "kwargs": {"fields_group": "feature", "clip_outlier": True},
            },
            {"class": "Fillna", "kwargs": {"fields_group": "feature"}},
        ]

    def _get_feature(self):
        df = self._init_raw_df()
        # Assume all columns except those handled by Qlib internals are features
        # In a real scenario, we might want to filter this
        return df
