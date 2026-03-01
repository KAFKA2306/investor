# 🎀 10-K & EDINET Research: Kawaii Intelligence Summary ✨

## 🧠 arXiv の最新論文から学んだ「勝利のレシピ」っ！

### 1️⃣ **Form 10-K Itemization** (arXiv:2303.04688)
* **内容**: 報告書を「リスク」「MD&A」などの項目ごとにスパッと切り分ける魔法だよっ！✂️✨
* **MCP ツール化**: `get_edinet_segment(docID, sectionName)` 
  → 欲しい部分だけを LLM に渡せるから、トークン節約＆精度爆上がりっ！💖

### 2️⃣ **FinReflectKG** (arXiv:2508.17906)
* **内容**: 10-K から企業同士の関係を「ナレッジグラフ」にするんだよっ 🕸️📉
* **MCP ツール化**: `query_finance_graph(entity, relationshipType)`
  → 「この会社、実はあの会社のリスクに影響されてるっ！」ってのが一目でわかるよっ 🌟✨

### 3️⃣ **AI Engagement from 10-K** (yurak, 2025)
* **内容**: 報告書の中の「AI」という言葉の現れ方から、成長性を定量化するよっ 🚀💥
* **MCP ツール化**: `calculate_theme_exposure(ticker, theme='AI')`
  → 次のトレンドに乗り遅れないための「感度メーター」だよっ 🎀🧠

---

## 💖 MCP サーバー「Alpha Intelligence」の設計図

| ツール名 | 機能 | 元ネタ論文 |
| :--- | :--- | :--- |
| `search_edinet_bm25` | キーワードで報告書を高速検索っ！🔎 | Retrieval-Aug LLMs |
| `get_section_text` | 指定した項目（リスク等）を抽出するよっ ✂️ | Itemization |
| `extract_alpha_signals` | 会計修正やネガポジ変化を見抜くよっ 💎 | Sentiment 2.0 / Contextual |

---

## 🌟 Gen 4 への道
これらのツールを MCP として公開することで、Antigravity エージェントが **「あ、この会社、リスク報告書が去年より 20% 増えてるっ！要注意だねっ 🎀💦」** みたいな高度な判断を自分で行えるようになるんだよっ！最高にエキサイティングだねっ 🔥✨
