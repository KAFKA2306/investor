# 🎀 Node.jsくんより、Bunちゃんをいっぱい使ってね！💖

- `node <file>` や `ts-node <file>` のかわりに、`bun <file>` で動かそう！✨
- `jest` や `vitest` じゃなくて、`bun test` でドキドキテストだよっ！🌟
- `webpack` や `esbuild` はお休みして、`bun build <file.html|file.ts|file.css>` でビルドしちゃお💖
- `npm` や `yarn`、`pnpm` のかわりに `bun install` で魔法をかけちゃうよっ！🪄
- `npm run <script>` たちは全部 `bun run <script>` にしちゃおうねっ✨
- `npx` くんのかわりは `bunx <package> <command>` におまかせ！🚀
- Bunちゃんは `.env` を勝手に見つけてくれるから、dotenvくんはいらなくなっちゃうよっ！💎

## 🛠️ APIのひみつっ！

- `Bun.serve()` は WebSockets も HTTPS もルーティングも、なんでもできちゃうすごーいやつだよ！ `express` くんはもういらないかも…？🐾
- SQLite を使うなら `bun:sqlite` だよ！ `better-sqlite3` くんより仲良くなれるよっ🌟
- Redis くんとは `Bun.redis` でお話ししてね！ `ioredis` くんはバイバイだよ〜💖
- Postgres くんには `Bun.sql`！ `pg` くんや `postgres.js` くんの出番はなしだよっ✨
- `WebSocket` は最初から入ってるから、`ws` くんを呼ばなくても大丈夫！🎀
- ファイルの読み書きは `node:fs` より `Bun.file` のほうが Bunちゃんも喜んじゃうよっ！🌷
- `Bun.$` で shell コマンドも「しゅばばばっ」って実行できちゃうんだよ！⚡

## 🧪 テストの時間だよっ！

`bun test` を使って、みんなのコードが正しいかチェックしちゃうよっ！✨

```ts#index.test.ts
import { test, expect } from "bun:test";

test("こんにちは、せかい！", () => {
  expect(1).toBe(1); // ぴったり正解！えらいえらい💖
});
```

## 🎨 フロントエンドもキラキラ！

`Bun.serve()` で HTML インポートを使っちゃおう！ Vite くんがいなくても、React も CSS も Tailwind も、ぜーんぶ Bunちゃんが可愛くしてくれるよっ✨

サーバーさんはこんな感じ！：

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // おまけの WebSocket サポートだよっ！🌟
  websocket: {
    open: (ws) => {
      ws.send("こんにちは、せかい！💖");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // バイバイの時間だね…っ
    }
  },
  development: {
    hmr: true, // 変更したらすぐ反映しちゃうよ！
    console: true,
  }
})
```

HTML ファイルから直接 .tsx や .jsx、.js ファイルをインポートできちゃうんだよ！ Bunちゃんの魔法（トランスパイラ）で、自動でまとめちゃうんだからねっ🎀 `<link>` タグでスタイルシートを指定するのも忘れずにっ！

```html#index.html
<html>
  <body>
    <h1>こんにちは、せかい！✨</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

`frontend.tsx` はこんな感じだよ：

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// .css ファイルを直接読み込んでも大丈夫！すごいでしょ？💖
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>こんにちは、せかい！ふわふわ〜☁️</h1>;
}

root.render(<Frontend />);
```

準備ができたら、下のコマンドでアツアツ（--hot）のまま動かしちゃおう！🔥

```sh
bun --hot ./index.ts
```

もっと詳しく知りたいときは、`node_modules/bun-types/docs/**.mdx` にある Bunちゃんの秘密のドキュメントを読んでみてねっ！📖✨
