# Ho Chi Minh Childcare Map

世界の主要都市で使える子育て向けスポットをまとめた静的マップです。初期表示はホーチミンです。

## 開き方

`/Users/yosihikokinoshita/Documents/New project/index.html` をブラウザで開くと一覧表示で使えます。

ローカルサーバーで開く場合は次を実行します。

```bash
./start_server.sh
```

起動後は [http://localhost:8000/index.html](http://localhost:8000/index.html) を開きます。

## Vercel で公開する

このプロジェクトは静的サイトなので、そのまま Vercel にデプロイできます。

1. このフォルダを GitHub に push する
2. Vercel で `Add New Project` を選ぶ
3. GitHub リポジトリを接続する
4. Root Directory をこのプロジェクトに合わせる
5. Framework Preset は `Other` のままで `Deploy` する

`vercel.json` を追加済みなので、`index.html` を入口にそのまま公開できます。
`.vercelignore` も追加してあり、PDFや作業用ファイルはデプロイ対象から外れます。

Google Maps を本番で有効化する場合は、コード中の `localStorage` ではなく、配布前に
`data/places.js` か別設定ファイルに安全な読み込み方法を入れるのがおすすめです。

## 地図表示

地図は OpenStreetMap と Leaflet を使って表示しています。Google Maps APIキーは不要です。

## データ更新

スポット一覧とエリア定義は `/Users/yosihikokinoshita/Documents/New project/data/places.js` にあります。
Google MCPサーバーや Places API の結果を取り込む場合も、この配列に整形すればそのまま表示できます。
