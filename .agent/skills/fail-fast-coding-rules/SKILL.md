---
name: fail-fast-coding-rules
description: 妥協と甘えを一切許さない「Fail Fast」の精神に基づいた、最強のクオンツ投資システムのコーディングスタイル。エラーは隠さず、即座に死に、正直なシステムを保つための鉄の掟。
---

# ✨ Fail Fast ぜったい遵守の鉄の掟 ✨

このスキルは、システムの信頼性を極限まで高め、市場の荒波の中でも「嘘をつかない」正直なエージェントであるための行動指針だよっ！💖

## 🤖 基本原則 (Core Principles) 🎀

1. **即死・即断・即決 (Die Instantly)**
   - 何かおかしいと思ったら、即座に例外を投けてシステムを止めること！
   - 「とりあえず動かす」ための `try-catch` によるエラー隠蔽は **大罪** だよっ！💢

2. **フォールバック禁止 (No Fallbacks)**
   - `?? 0` や `?? ""`、`?? []` のようなフォールバックは原則禁止！
   - データがないなら、正直に「ないっ！」って叫んでエラーにするのがプロのたしなみだよっ。

3. **捏造禁止 (Never Stub)**
   - `Math.random()` 等を使った合成データ（Synthetic Data）やダミーデータの生成は絶対にダメ！
   - 本物の証拠（Evidence）だけを信じて、捏造された安らぎには頼らないんだもんっ。

4. **定量的真実 (Quantitative Truth)**
   - 言語評価（Linguistic Score）のような主観的で曖昧な指標は排除すること！
   - バックテストの結果や統計的な IC 等、数値で証明できる事実だけをアウトカムにするよ。

## 🛠️ 具体的なコーディング例 📝

### ❌ 甘えのあるコード (The Weak)
```typescript
try {
  const result = await db.query("...");
  return result ?? { score: 0 }; // 失敗を隠してデフォルト値を返す
} catch (e) {
  logger.warn("まあいいか...", e);
  return { score: 0 };
}
```

### ✅ Fail Fast なコード (The Strong)
```typescript
const result = await db.query("...");
if (!result) {
  throw new Error("[AUDIT] Critical data missing in DB. Fail Fast.");
}
return result; // 失敗はそのまま上に突き抜けるっ！🔥
```

## 🎀 エージェントさんへの命令っ ✨
- 常に「このコードは失敗を隠していないか？」と自問自答してねっ！
- ユーザーに甘い顔をするんじゃなくて、**「正直なエラー」** を届けることこそが愛なんだよっ！💖🌈👑
