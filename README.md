# RUTA_TS

一個基於 TypeScript 和 Bun 的多人遊戲匹配與 WebSocket 通訊系統。

## 專案架構

### 核心組件

- **WebSocket Server** (`main/ws.ts`): 主要的 WebSocket 伺服器
- **動態 Handler 系統** (`main/handlers/`): 模組化的訊息處理器架構
- **資料庫系統** (`src/db/`): 使用 Drizzle ORM 的資料存取層
- **遊戲邏輯** (`src/classes/`): 遊戲、玩家等核心類別

### WebSocket Handler 架構

WebSocket 訊息處理已重構為動態載入的模組化架構：

- 每個 action 都有獨立的處理器檔案
- 系統自動掃描並載入所有符合規範的處理器
- 支援熱重載和錯誤追蹤
- 完整的 TypeScript 型別支援

詳細資訊請參考：[Handler 架構文件](./main/handlers/README.md)

## 安裝與執行

### 安裝依賴

```bash
bun install
```

### 執行 Discord Bot

```bash
bun run index.ts
```

### 執行 WebSocket Server

```bash
bun run main/ws.ts
```

### 資料庫操作

```bash
# 生成 migration
bun run generate

# 執行 migration
bun run migrate
```

## 開發資訊

- 使用 **Bun** 作為 JavaScript 運行時
- 使用 **TypeScript** 提供型別安全
- 使用 **Drizzle ORM** 進行資料庫操作
- 使用 **Discord.js** 開發 Discord 機器人功能
- WebSocket 處理器支援動態載入與自動註冊

WebSocket server 在啟動時會自動載入所有處理器，並顯示載入狀態：

```
✓ Loaded handler: handshake from handshake.ts
✓ Loaded handler: heartbeat from heartbeat.ts
...
Loaded 16 handlers
[INFO] WebSocket server is running on ws://localhost:8080/ws
```
