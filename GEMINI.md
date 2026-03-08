# ✨ 戦略的マンデート：自律型アルファ生成のひみつ ✨

このドキュメントは、**自律型クオンツ投資システム**さんの進むべき道をきめた、とっても大事なガイドラインだよっ！💖 このシステムは、**Gemini 3.0 Pro**ちゃんのすごーい思考力で「アルファ」を見つけ出して、**Strict TypeScript**くんで完璧に実行しちゃう、自己進化型のアルファ生成パイプラインなんだよ〜✨

## 🌟 戦略的な目標（ゴール！）
1. **アルファをい〜っぱい抽出！**: 普通じゃ気づけないような、市場の隠れたサインを自律的に見つけちゃうよっ。
2. **リスクをぴたっと抑制！**: ストラテジーが本当に正しいか、常に厳しくチェックして、どんな相場でも負けないように守るよ🛡️✨
3. **実行のしんらいせい（信頼性）バッチリ！**: 無駄をぜーんぶ省いた最強のインフラで、バックテストも本番も、完璧にこなしちゃうんだもん！
4. **Crash-Driven Development (CDD) の徹底！**: 「Fail Fast, Fail Loud」が合言葉だよっ！💖 エラーは隠さず、スタックトレースを唯一の真実として受け入れて、高速に進化し続けるんだもんっ！🔥✨

## 🚀 さいきょうのテクノロジースタック（アルファのための基盤だよ！）
- **実行エンジン**: [Bun](https://bun.sh/) - データを大量に扱うクオンツのお仕事も、爆速でこなしちゃうすごいやつだよ！⚡
- **かしこい知能**: Gemini 3.0 Pro - センチメントの分析や、新しい因子の仮説、資産をまたいだ推論までできちゃう天才ちゃん！🧠💎
- **ぜったい安心な検証**: Strict TypeScript + Zod - 「汚いデータ」は絶対に入れないよ！証拠をしっかり固めて、アルファの工場を守るんだからねっ💢✨
- **データの入り口**: J-Quants（制度開示）、Yahoo Finance、e-Stat（政府統計）にいつでもアクセスできちゃうよ！🌐
- **みらい予測**: Amazon ChronosやGoogle TimesFMみたいな、最先端の時系列モデルと合体してるよ！📈

## 🛠️ うんようアーキテクチャ（なかまたち！）
このシステムは、特別なスキルを持った**自律型アナリスト**たちのチームで動いてるよっ！🐾
- **アルファ・ファクトリー (`ts-agent/src/agents/`)**: 因子を探す `LesAgent`、イベントを追う `PeadAgent`、感情を読み取る `XIntelligenceAgent` みたいな、個性豊かなエージェントたちが大活躍！🏭✨
- **オーディット・エンジン (`ts-agent/src/core/`)**: みんなの仕事が正しいか、ずっと見守って検証し続けるしっかり者だよ！🔍
- **データ・ファブリック (`ts-agent/src/gateways/`)**: 高品質なデータを、正しいタイミング（PIT）でばっちり取り込むよ！🌐
- **じっけん用サンドボックス (`ts-agent/src/experiments/`)**: 新しいアイデアや研究を、しゅばばばっと試作して再現しちゃう場所だよ！🏖️

---

## 🏃‍♂️ 作る！動かす！

### 開発のサイクルだよっ ⚙️
| コマンド | なにするの？ |
| :--- | :--- |
| `task check` | Biomeくんでコードを綺麗にして、TypeScriptくんの型チェックを受けるよ！✨ |
| `task discovery` | 新しいアルファ探しと、モデルのベンチマークを一気にやっちゃうよ！🔍🚀 |
| `task benchmark:foundation` | e-Statのデータを使って、予測モデルたちの実力をはかるよ！📊 |
| `task run` | 探索から準備まで、フルコースで実行しちゃうよ！わくわく！🔥 |
| `task view` | Viteベースのダッシュボードを開いて、結果をにこにこ眺めるよっ！💻💖 |

### 予測モデルの登録所 📝
時系列のすごーいモデルたちのための**標準モデルレジストリ** (`ts-agent/src/model_registry/`) があるよ！
- **モデルたち**: Amazon Chronos (t5-tiny/mini/small) や Google TimesFM と仲良しだよっ。
- **推論**: Python/PyTorchへの橋渡しをして、い〜っぱいまとめて推論できちゃう！⚡
- **ベンチマーク**: 経済指標を使って、モデルがどれくらい優秀か（RMSEとかね！）をいつも追いかけてるよっ。

---

## 🎀 開発のお約束

### コーディングのルール 📝
- **型はきっちりと！**: 新しいコードは絶対に Strict TypeScript のルールを守ってね！ `any` なんて使ったらめっ！だよ？💢
- **見た目も美しく**: `task check` を使って、みんなでコードの綺麗さを揃えようねっ✨
- **エージェントの形**: 新しい戦略を作るときは、`BaseAgent` を継承して `run()` メソッドを実装してね！
- **データの安全**: ゲートウェイから入ってくるデータは、`ts-agent/src/schemas/` のスキーマでしっかりチェックするよ！🛡️

### ドキュメンテーション 📖
- **図解**: `docs/diagrams/` にある Mermaid の図を見れば、システムの動きが一目でわかって、とってもハッピーになれるよ！🌈
- **Markdown ガイド**: [markdown_dx_guide.md](file:///home/kafka/finance/investor/docs/markdown_dx_guide.md) を読めば、Markdown の書き方がバッチリわかるよっ！✨
]Achieve the goal with MINIMAL changes. Extra changes introduce extra bugs and slow review. NO comments in code. Good code reads itself; comments rot and mislead. Respond clearly, specifically, and concisely. Vague answers waste time and create misunderstanding.

# No Safety Nets
NEVER write defensive code. NO error handling, NO dummy code, NO try-catch. Defensive code hides bugs and delays discovery. Focus on making the main logic succeed.
- Build the minimal thing, run it, and let it crash. Real failures teach faster than hypothetical planning.
- Implement the smallest possible structure and EXECUTE IMMEDIATELY. Speed of iteration beats depth of speculation.
- A crash is NOT a problem — it is design feedback. NEVER fear execution. Fear of running code leads to over-engineering.
- Follow the strict cycle: CRASH → IDENTIFY ROOT CAUSE → MINIMAL FIX. Repeat relentlessly. Each cycle sharpens understanding of the actual system.
- REJECT upfront over-engineering. Only real failures dictate real improvements. Imagined edge cases produce imagined solutions.
- READ every crash log and traceback with absolute precision. Fix the ROOT CAUSE, not the symptom. Symptom fixes guarantee repeat failures.

# Project Structure Rules
Always consider proper directory structure. Disorganized layout makes code hard to find and responsibilities unclear.
- Taskfile.yml is the CLI. All executable operations MUST be defined as Taskfile tasks. Direct script invocation is forbidden. A single entry point keeps execution discoverable and reproducible.
- **TS/Bun**: ALWAYS use `bun` to run scripts. ALL dependencies MUST be managed via `package.json` and `bun install`. No direct `node` invocation, no ad-hoc installs. **Python**: ALWAYS use `uv run`. ALL dependencies via `pyproject.toml`. No `pip install`, no `requirements.txt`.
- src/domain/* holds ALL domain logic. Business rules, models, and core computations live here exclusively. Scattering domain logic across layers makes it untestable and hard to reason about.
- src/io/* holds ALL data input/output. File reads, API calls, database access, and any external data exchange live here exclusively. Isolating I/O from domain logic keeps the core pure and testable.
- config/default.yaml is the SINGLE source of configuration. No hardcoded values, no scattered config files. One config file means one place to look, one place to change.
- Agent skills are managed via `agr` (agent-resources). Use `agr add` to install, `agr.toml` to track dependencies, and `agr sync` to reproduce environments. Manual skill file management leads to inconsistency across machines and team members.

# Code Quality Rules
- Run linters and type checkers before every commit via Taskfile tasks. **TS/Bun**: `tsc --noEmit` + `eslint src`. **Python**: `ruff check` + `ruff format` + `uv run ty check`. Automated checks catch style drift and type errors before review.
- Use schema-validated models for ALL data structures. **TS/Bun**: Use Zod. No plain objects or `any`. **Python**: Use Pydantic. No dataclasses or plain dicts. Validation at the boundary makes schemas explicit and failures loud.
- Use higher-order functions or decorators to share cross-cutting concerns (logging, timing, caching). Duplicating boilerplate across functions invites inconsistency; centralizing behavior keeps it consistent.

# Frontend Rules
- Keep it simple HTML. No frameworks unless explicitly required. Plain HTML is fast to write, easy to debug, and has zero build overhead.
- Serve and develop via `task dev`. Frontend dev workflow MUST go through Taskfile like everything else. Separate dev commands fragment knowledge and break onboarding.
