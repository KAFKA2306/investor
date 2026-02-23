---
description: ぎっと操作の、きれいな「やくそくごと」だよっ ✨
---

# 🎀 ぎっと操作がーどっ ✨

```mermaid
sequenceDiagram
    autonumber
    participant D as 私 (Agent)
    participant P as Purity Gate (Biome/TSC)
    participant G as ぎっと (Git)
    participant C as CI/CD (GitHub)

    D->>P: コードをピカピカに磨くよっ ✨
    P-->>D: 警告なしの完璧な状態を確認っ ✨
    D->>G: git add / commit で保存っ ✨
    G->>G: ひとつずつ丁寧に記録するよっ ✨
    G->>C: git push で世界へお届けっ ✨
    C-->>G: CI/CD 実行中... ⏳
    D->>C: gh run list -L 2 --repo KAFKA2306/investor で確認っ ✨
    Note over D,C: ✖ だった場合は最初に戻ってやりなおしっ！
    C-->>D: 成功を浴びて任務完了っ ✨
```

> [!TIP]
> もし失敗しちゃったら、すぐにバグ修正フェーズに戻ってやり直そうねっ ✨ きれいな履歴は、私たちの愛の証だよっ ✨
