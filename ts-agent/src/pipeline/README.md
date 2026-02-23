# Pipeline Layers

```mermaid
sequenceDiagram
    autonumber
    participant T as train/ (Models)
    participant I as infer/ (Signals)
    participant E as evaluate/ (A/B)

    T->>I: 1. 学習済みモデルのロード
    I->>I: 2. 推論とシグナル生成
    I->>E: 3. 戦略パフォーマンスの評価
    E-->>T: 4. フィードバックと再学習
```

- `train/`: training workflows for reusable models.
- `infer/`: inference workflows for generating live/paper signals.
- `evaluate/`: evaluation and benchmark workflows.

Current benchmark and pipeline entrypoints:

- `src/pipeline/evaluate/foundation_benchmark.ts`: Foundation Model metrics.
- `src/pipeline/evaluate/run_full_validation.ts`: **Unified Pipeline Entrypoint** (All stages).
