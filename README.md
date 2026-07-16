# 合成心光｜脩與主人的小遊戲

手機版落下合成遊戲。玩家可以輸入名字、選擇主人與脩的球面套裝、累積單局分數並登上排行榜。

## 遊戲內容

- 左右移動與放下球
- 相同角色碰撞合成
- 經典相伴、晴空日常、星夜守護三套球面
- 每局獨立排行榜紀錄
- 個人最佳、最佳名次與累計局數
- 手機本機保存玩家名字、最佳分數與球面選擇

## GitHub Pages

這個儲存庫包含 GitHub Pages 靜態版入口：

```bash
npm ci
npm run build:github
```

靜態輸出會建立於 `dist-pages/`。GitHub Pages 前端會連線至現有的排行榜 API，因此不同網址仍共用同一份排行榜資料。

## 開發

```bash
npm ci
npm run lint
npm run build:github
```

完整 Sites 版本使用 Vinext、Cloudflare Worker、D1 與 Drizzle；GitHub Pages 則使用 Vite 產生靜態前端。
