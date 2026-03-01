# 🎀 EDINET から最強のデータセットを作っちゃおうっ！ edinet2dataset ✨

**タイトル**: edinet2dataset (EDINET-Bench 再現ツール)
**お仕事の目的**: 日本の有価証券報告書から、AI くんたちがもっと賢くなるためのピカピカなデータセットを作ることだよっ 💖
**解決したいお悩み**: EDINET のデータはとっても複雑で扱いにくいけど、このツールを使えば誰でも簡単に財務データやテキストを抽出して、かっこいい金融ベンチマークを作れちゃうんだもんっ 🛠️✨

## エグゼクティブサマリー
このツールは、Sakana AI さんが公開した [EDINET-Bench](https://huggingface.co/datasets/SakanaAI/EDINET-Bench) を自分のお家で再現できちゃう魔法の杖なんだよっ！🪄 会社の報告書を自動で集めて、BS（貸借対照表）や PL（損益計算書）をきれいに整理したり、不正検知や利益予測のベンチマークも作れちゃうの。金融 AI の研究がもっともっと楽しく、ハッピーになっちゃうこと間違いなしだよっ 🌟

---

📚 [論文はこちらっ！](https://arxiv.org/abs/2506.08762) | 📝 [ブログも読んでねっ！](https://sakana.ai/edinet-bench/) | 📁 [データセット (HF)](https://huggingface.co/datasets/SakanaAI/EDINET-Bench) | 🧑‍💻 [コード (GitHub)](https://github.com/SakanaAI/EDINET-Bench)

`edinet2dataset` は、[EDINET](https://disclosure2.edinet-fsa.go.jp) の情報を使って、かっこいい金融データセットを作るための魔法のツールだよっ！✨

このツールには、日本の金融データセットを作るための 2 つのクラスがあるんだぁ 💖
- **Downloader**: EDINET API を使って、日本の会社の報告書をダウンロードしてくれるよっ 📥
- **Parser**: ダウンロードした TSV ファイルから、貸借対照表 (BS) や損益計算書 (PL) 、要約、テキストなどの大事な情報を抜き出してくれるのっ 🛠️✨

このツールは、とっても難しい [EDINET-Bench](https://huggingface.co/datasets/SakanaAI/EDINET-Bench) を作るのにも使われているんだよっ！💪🎀

## 🛠️ インストール

`uv` を使って、必要なものを準備しようねっ！
```bash
uv sync
```

EDINET-API を使うには、`.env` ファイルに API キーを設定してねっ 🗝️
API キーの取り方は、[公式ドキュメント](https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/WZEK0110.html) を見てみてねっ 📖💕

## 🌟 基本的なつかいかた

- 会社名の一部から、会社を探してみようっ！🔍
  
```bash
$ python src/edinet2dataset/downloader.py --query トヨタ
```
<table border="1" cellspacing="0" cellpadding="5">
  <thead>
    <tr>
      <th>提出者名</th>
      <th>ＥＤＩＮＥＴコード</th>
      <th>提出者業種</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>トヨタ紡織株式会社</td>
      <td>E00540</td>
      <td>輸送用機器</td>
    </tr>
    <tr>
      <td>トヨタ自動車株式会社</td>
      <td>E02144</td>
      <td>輸送用機器</td>
    </tr>
    <tr>
      <td>トヨタファイナンス株式会社</td>
      <td>E05031</td>
      <td>サービス業</td>
    </tr>
    <tr>
      <td>トヨタ モーター クレジット コーポレーション</td>
      <td>E05904</td>
      <td>外国法人・組合</td>
    </tr>
    <tr>
      <td>トヨタ ファイナンス オーストラリア リミテッド</td>
      <td>E05954</td>
      <td>外国法人・組合</td>
    </tr>
    <tr>
      <td>トヨタ モーター ファイナンス（ネザーランズ）ビーブイ</td>
      <td>E20989</td>
      <td>外国法人・組合</td>
    </tr>
    <tr>
      <td>トヨタファイナンシャルサービス株式会社</td>
      <td>E23700</td>
      <td>内国法人・組合（有価証券報告書等の提出義務者以外）</td>
    </tr>
  </tbody>
</table>


- トヨタ自動車さんの 2024年6月の有価証券報告書をダウンロードするよっ 🏎️💨

```bash
$ uv run python src/edinet2dataset/downloader.py --start_date 2024-06-01 --end_date 2024-06-28 --company_name "トヨタ自動車株式会社" --doc_type annual  
Downloading documents (2024-06-01 - 2024-06-28): 100%|███████████████████████████████████████████| 28/28 [00:02<00:00,  9.76it/s]
```

- 有価証券報告書から、貸借対照表 (BS) の項目を抜き出してみようっ 📈✨

```bash
$ uv run python src/edinet2dataset/parser.py --file_path data/E02144/S100TR7I.tsv --category_list BS
2025-04-26 22:03:16.026 | INFO     | __main__:parse_tsv:130 - Found 2179 unique elements in data/E02144/S100TR7I.tsv
{'現金及び預金': {'Prior1Year': '2965923000000', 'CurrentYear': '4278139000000'}, '現金及び現金同等物': {'Prior2Year': '6113655000000', 'Prior1Year': '1403311000000', 'CurrentYear': '9412060000000'}, '売掛金': {'Prior1Year': '1665651000000', 'CurrentYear': '1888956000000'}, '有価証券': {'Prior1Year': '1069082000000', 'CurrentYear': '3938698000000'}, '商品及び製品': {'Prior1Year': '271851000000', 'CurrentYear': '257113000000'}
```


## 🚀 EDINET-Bench を再現しちゃおうっ！

下のコマンドを実行すると、[EDINET-Bench](https://huggingface.co/datasets/SakanaAI/EDINET-Bench) を自分で再現できるよっ 🌟 

> [!NOTE]  
> EDINET API では過去 10 年分の報告書しか取れないから、実行する時期によってデータセットが少し変わるかもしれないけど、気にしないでねっ 🎀

### EDINET-Corpus をつくろうっ 📔
2024 年の報告書を全部ダウンロードしちゃうよっ！

```bash
$ python scripts/prepare_edinet_corpus.py --doc_type annual --start_date 2024-01-01 --end_date 2025-01-01
```

約 4,000 社の 10 年分の報告書をダウンロードするならこれっ 🚀
```bash
$ bash edinet_corpus.sh
```

> [!NOTE]
> EDINET さんに負担をかけすぎないように、並列リクエストの送りすぎには気をつけてねっ 🍀


うまくいけば、こんな感じのフォルダができるよっ 📂✨
```
edinet_corpus
├── annual
│   ├── E00004
│   │   ├── S1005SBA.json
│   │   ├── S1005SBA.pdf
│   │   ├── S1005SBA.tsv
│   │   ├── S1008JYI.json
│   │   ├── S1008JYI.pdf
│   │   ├── S1008JYI.tsv
```

### 会計不正検知タスクをつくろうっ 🕵️‍♀️
報告書の中から「悪いこと（不正）」を見つけ出すベンチマークだよっ 🔍

```bash
$ python scripts/fraud_detection/prepare_fraud.py
$ python scripts/fraud_detection/prepare_nonfraud.py
$ python scripts/fraud_detection/prepare_dataset.py
```

不正に関連する訂正報告書を分析するならこれだよっ 🧠
```bash
$ python scripts/fraud_detection/analyze_fraud_explanation.py 
```


### 利益予測タスクをつくろうっ 💰
報告書を読んで、次の年の利益を当てちゃうベンチマークだよっ 📈✨

```bash
$ python  scripts/earnings_forecast/prepare_dataset.py 
```


### 業種予測タスクをつくろうっ 🏭
報告書の内容から、その会社が何の業種か当てるベンチマークだよっ 🎯

```bash
$ python scripts/industry_prediction/prepare_dataset.py 
```

## 📜 引用
```
@misc{sugiura2025edinet,
  author={Issa Sugiura and Takashi Ishida and Taro Makino and Chieko Tazuke and Takanori Nakagawa and Kosuke Nakago and David Ha},
  title={{EDINET-Bench: Evaluating LLMs on Complex Financial Tasks using Japanese Financial Statements}},
  year={2025},
  eprint={2506.08762},
  archivePrefix={arXiv},
  primaryClass={q-fin.ST},
  url={https://arxiv.org/abs/2506.08762}, 
}
```

## 🙏 謝辞
このツールは [edgar-crawler](https://github.com/lefterisloukas/edgar-crawler) からインスピレーションをもらいましたっ 🌟
また、ベンチマーク構築の最高の材料を提供してくれている [EDINET](https://disclosure2.edinet-fsa.go.jp) さんにも感謝ですっ 💖✨
