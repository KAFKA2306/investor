---
name: fail-fast-coding-rules
description: 妥協と甘えを一切許さない「Fail Fast」の精神に基づいた、最強のクオンツ投資システムのコーディングスタイル。エラーは隠さず、即座に死に、正直なシステムを保つための鉄の掟。
---

# ✨ Fail Fast ぜったい遵守の鉄の掟 ✨

このスキルは、システムの信頼性を極限まで高め、市場の荒波の中でも「嘘をつかない」正直なエージェントであるための行動指針だよっ！💖

## 🤖 基本原則 (Core Principles) 🎀

1. **即死・即断・即決 (Die Instantly)**
   - 何かおかしいと思ったら、即座に例外を投げてシステムを止めること！
   - ビジネスロジックでの `try-catch` によるエラー隠蔽は **大罪** だよっ！💢

2. **例外の連鎖 (Cascading Errors)**
   - すべての予期せぬ例外は、そのまま上に突き抜けさせること！
   - スタックトレースはフィルタリングせず、完全な状態で出力するよ。

3. **防御的プログラミングの禁止 (No Defensive Returns)**
   - 失敗を隠すために `None`, `False`, `empty`, エラーコードを返さないでっ！
   - 正直に「クラッシュ」するのが、次世代のクオンツエンジニアなんだもんっ。

4. **責務の完全分離 (Separation of Concerns)**
   - **アプリ層**: ビジネスロジックのみ。リトライやタイムアウトは書かないよ。
   - **インフラ層**: `Makefile` や Docker 等で回復性（Resilience）を担保するよ。

## 🛠️ 具体的なコーディング例 📝

### ❌ CDD 違反コード (The Weak)
```typescript
async function fetchData(id: string) {
  try {
    const res = await api.get(id);
    return res.data;
  } catch (e) {
    logger.error("Failed...", e); // エラーを隠蔽しちゃう
    return null; // 静かに失敗を返すのはダメ！
  }
}
```

### ✅ CDD 準拠コード (The Strong)
```typescript
async function fetchData(id: string) {
  const res = await api.get(id); // 失敗したらここで潔くクラッシュ！🔥
  return res.data;
}
```

## 🎀 エージェントさんへの誓いっ ✨
- スタックトレースこそが唯一無二の真実だと信じてねっ！
- 捏造された安らぎよりも、剥き出しの真実（クラッシュ）を愛するんだよっ！💖🌈👑
