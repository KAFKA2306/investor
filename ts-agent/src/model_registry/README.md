# Model Registry (Link-Only)

```mermaid
sequenceDiagram
    autonumber
    participant U as あなた (User)
    participant M as models.json
    participant V as Source Verification

    U->>V: 1. arxiv / github リンクの検証
    V-->>U: 成功 (Verified)
    U->>M: 2. 新しいエントリの追加
    M-->>U: 3. 更新されたレジストリ
    Note over M: 既存 ID の編集は禁止
```

This directory is a minimal registry for external forecasting models.

- No local model implementation.
- No local wrapper maintenance.
- Keep only canonical links and IDs.

## Files

- `models.json`: machine-readable model registry.

## Usage

- For `Context7`, use `context7LibraryId`.
- For papers, use `arxiv`.
- For implementation sources, use `github`.

## Policy

- Add a new entry instead of editing historical IDs.
- Keep fields non-empty when a source is verified.
- Keep this registry vendor-agnostic and scenario-agnostic.
