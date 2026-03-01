# uv / pyproject / env 一元管理ウォークスルー

## 目的
- Python 実行環境を `uv workspace` で一元管理する。
- `task run` をルートから再現可能に実行できる状態を維持する。
- secret は config ファイルに書かず、`.env` でのみ管理する。

## 最終構成
1. 依存関係の単一ソース
- ルート `pyproject.toml` + ルート `uv.lock` を正本とする。
- `ts-agent` / `edinet2dataset` は workspace member として参加する。

2. 環境変数の単一ソース
- ルート `.env` を正本とする。
- `ts-agent/.env` はレガシー互換の読み込み候補（fallback）のみ。
- `default.yaml` は `apiKeyEnv` / `appIdEnv` の「環境変数名」だけを持つ。

3. Task 実行の統一
- Python 実行は `uv run` 経由で起動する。
- `task run` はルート起点で同一手順になる。

## 運用手順
1. 初回セットアップ
```bash
cp .env.example .env
uv sync
```

2. 日常実行
```bash
task check
task run
```

3. 再現実行（CI/検証用）
```bash
uv sync --frozen
```

## Secret 管理ルール
- 禁止: `default.yaml` / `Taskfile.yml` / `README.md` に秘密値を直書きする。
- 許可: `.env` にのみ秘密値を保存する。
- 推奨: 事故時は API キーを再発行し、旧キーを無効化する。

## 障害時チェックリスト
1. `uv sync` が成功するか。
2. `bun run typecheck` が成功するか（`ts-agent/`）。
3. `.env` に `JQUANTS_API_KEY` / `EDINET_API_KEY` / `ESTAT_APP_ID` があるか。
4. `task run` 失敗時は最初の失敗タスクを再実行して原因を切り分ける。

## 受け入れ基準
- `uv sync` 成功。
- `task run` が exit code 0。
- config に secret 実値が存在しない。
- `.env` は追跡対象外で、`.env.example` は追跡対象である。
