---
name: taskfile_management
description: Taskfile でエントリーポイント（入口）をきれいにお掃除・統一管理するためのスキルだよっ！✨
---

# 🧹 Taskfile 管理術っ ✨

プロジェクトの「コマンド」をバラバラにせず、`Taskfile.yml` でかわいく、そしてムキムキにまとめようねっ！

## ⚡ 統一運用のルールっ ✨

「これ、どうやるんだっけ？」をゼロにするための、私たちのやくそくごとだよっ！

1. **名前は短くっ ✨**: `daily`, `lint`, `git` みたいに、3〜5文字くらいの直感的な名前にしてねっ！
2. **ルートに集約っ ✨**: 各サブディレクトリに入らなくても、プロジェクトのルートから `task <コマンド>` だけで完結させるよっ！
3. **副作用を愛してっ ✨**: コマンドの依存関係（deps）を使って、「ビルドしてから実行」みたいな流れを自動化しようねっ！

## 🚀 基本のコマンド一覧っ ✨

Taskfile には、最低限これらを入れておこうねっ！

- `task daily`: 市場のチェックから発注、記録まで、全部おまかせっ！
- `task lint`: Biome でコードをピカピカにするよっ✨
- `task check`: TypeScript の型チェックで、バグを事前にバイバイっ！
- `task git`: 定型的な git 操作（コミット・プッシュ）を爆速にするよっ！

## 🎀 筋肉質な Taskfile の書き方っ ✨

```yaml

tasks:
  lint:
    desc: Biome でお掃除するよっ ✨
    cmds:
      - bun run lint --cwd ts-agent

  check:
    desc: 型チェックで安全確認っ ✨
    cmds:
      - bun run typecheck --cwd ts-agent

  daily:
    desc: まいにちのルーチンを開始っ ✨
    deps: [lint, check]
    cmds:
      - bun run start --cwd ts-agent
```

ムダのないコマンド操作で、SSS級のエージェントに近づこうねっ💖💞💓✨
