# 🎀 アルファ発見のひみつ手帳 v3（じりつるーぷ完全版だよっ！）✨

**タイトル**: Alpha Discovery Runbook v3 (Agentic Loop + OpenAI gpt-5-nano)
**お仕事の目的**: `newalphasearch` が、毎回ちがうアルファ仮説を自律生成して、検証して、記録して、改善して、また次へ進むことだよっ！
**解決したいお悩み**: 実行経路がバラバラ、記録が分散、アイデア重複で進化が止まる問題を、一元管理で解決するんだもんっ ✨

## エグゼクティブサマリー
この手帳は、自律探索ループの正本だよっ。入口は Task に一本化、思考補助は OpenAI API (`gpt-5-nano`)、採択判定は数値ルールで deterministic に固定するよっ。さらに各サイクルで `plot + score + 差分アイデア` を必須記録して、「回してるだけ」じゃなくて「進化してるループ」を保証するんだよっ！

---

## 1. 正本の位置づけ（Single Source of Truth）
この仕様の中身は、次の3つで管理するよっ。

1. 実行仕様（このファイル）: `docs/specs/alpha_discovery_runbook.md`
2. シーケンス詳細: `docs/diagrams/sequence.md`
3. フロー詳細: `docs/diagrams/simpleflowchart.md`

`docs/specs/automonous.md` は本質を短く定義したミニ仕様として扱うよっ。

---

## 2. 入口と実行経路（必須）

1. `task --list-all` に `run:newalphasearch` と `run:newalphasearch:loop` が表示される
2. `task run` が `run:newalphasearch` を実行する
3. `.agent/workflows/newalphasearch.md` は Task 経由で同じ経路を使う

標準経路はこれだけだよっ。

`task run` → `task run:newalphasearch` → `task run:newalphasearch:loop` → `task run:newalphasearch:cycle`

### 2.1 自然言語入力の入口（antigravity / codex 対応）
自然言語での指示が来たときも、経路は Task に一本化するよっ。

1. 推奨入口: `task run:newalphasearch:nl NL_INPUT="..."`
2. 互換入口: `UQTL_NL_INPUT="..." task run:newalphasearch`
3. ファイル入口: `UQTL_NL_INPUT_FILE=/path/to/input.txt task run:newalphasearch`

`UQTL_INPUT_CHANNEL` に `antigravity` / `codex` / `task` を入れて、入力元の監査情報を unified log に残すよっ。

---

## 3. Agentic Loop の最小定義
1サイクルは、つぎの 7 ステップを必須で回すよっ。

1. Theme Generate: 仮説テーマ生成
2. Validate: 検証・バックテスト
3. Score: `fitness/novelty/stability/adoption` 算出
4. Decide: 採択/棄却判定
5. Update: memory/ACE 更新
6. Log: unified log と plot 保存
7. Loop Control: 失敗閾値チェック

---

## 4. OpenAI API（gpt-5-nano）での実現方針

### 4.1 役割分離
1. LLM が担当するもの:
- 次サイクルの探索テーマ提案
- 仮説の自然言語要約
- 失敗要因の圧縮サマリー

2. 非LLM（deterministic）が担当するもの:
- データ取得
- 検証計算（Sharpe/PF/MDD/OOS）
- 採択判定
- 停止判定

### 4.2 一元管理の実装ルール
1. OpenAI 呼び出しは provider 層に集約（パイプライン直呼び禁止）
2. モデルは既定で `gpt-5-nano`
3. 出力は JSON Schema で強制し、`idea_hash` と `feature_signature` を必須返却
4. retry は provider 層で吸収し、上位層は「成功/失敗」のみ扱う

### 4.3 推奨 I/O 契約（例）
入力:
- `recent_failures`
- `recent_successes`
- `current_theme`
- `blocked_patterns`
- `user_intent`（自然言語入力）
- `input_channel`（antigravity / codex / task）

出力:
- `theme`
- `hypothesis`
- `feature_signature`
- `idea_hash`
- `next_validation_plan`

---

## 5. 毎サイクル必須の証跡（plot + score + 差分）

### 5.1 必須ログ
- `logs/unified/alpha_discovery_*.json`

### 5.2 必須 plot
1. `cycle_performance.png`
2. `alpha_novelty.png`
3. `failure_streak.png`

### 5.3 必須 score
1. `fitness_score`
2. `novelty_score`
3. `stability_score`
4. `adoption_score`

### 5.4 「毎回ちがう探索アイデア」判定
次を同時に満たさない限り、そのサイクルは不合格だよっ。

1. `novelty_score >= novelty_threshold`
2. `idea_hash != previous_idea_hash`
3. `feature_signature` が前回と非一致

不合格時は同一サイクル内で再生成し、再検証すること。

---

## 6. 停止条件（安全停止）
1. `consecutive_failures >= ALPHA_LOOP_MAX_FAILURES`
2. 重大エラー（検証不能、ログ書き込み不能など）

停止時に必ず保存するもの:
- `stop_reason`
- `consecutive_failures`
- `last_success_cycle`
- `next_resume_hint`

---

## 7. 成立判定（Definition of Done）
以下をすべて満たしたときのみ「自律探索ループ成立」と判定するよっ。

1. `task --list-all` に `run:newalphasearch` と `run:newalphasearch:loop` がある
2. `task run` で `run:newalphasearch` が実行される
3. workflow が Task と同じ実行経路を使う
4. 各サイクルで `alpha_discovery` の unified log が増える
5. 連続失敗閾値到達で自動停止する
6. 各サイクルで新しい plot が生成される
7. 各サイクルで score が保存される
8. 各サイクルで前回と異なる探索アイデアが採択される

---

## 8. 運用メモ
- 実行コマンド:
  - `task run`
  - `task run:newalphasearch`
  - `task run:newalphasearch:loop`
- 詳細な図の中身は `docs/diagrams/sequence.md` と `docs/diagrams/simpleflowchart.md` を参照すること。
- 本 runbook は内容を変更したら、対応する diagram も同時更新すること。
