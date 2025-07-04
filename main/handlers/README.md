# WebSocket Handler 動態載入架構

## 概述

WebSocket Handler 已經重構為動態載入的模組化架構，每個處理器都放在獨立的檔案中，系統會自動掃描並載入所有符合規範的處理器檔案。

## 架構特色

- **動態載入**: 自動掃描 handlers 目錄並載入所有處理器
- **Action 匹配**: 每個檔案匯出自己的 Action，系統自動建立映射
- **錯誤追蹤**: 無法載入的處理器會被記錄並報告
- **型別安全**: 使用 TypeScript 提供完整的型別檢查

## 資料夾結構

```
main/handlers/
├── index.ts                    # 動態載入系統和處理器路由
├── types.ts                    # Handler 介面和型別定義
├── handshake.ts               # 握手處理器
├── heartbeat.ts               # 心跳處理器
├── request.ts                 # 資料請求處理器
├── get_player_data.ts         # 獲取玩家資料處理器
├── update_player_data.ts      # 更新玩家資料處理器
├── party.ts                   # 建立/更新隊伍處理器
├── party_disbanded.ts         # 解散隊伍處理器
├── queue.ts                   # 加入排隊處理器
├── queue_leave.ts             # 離開排隊處理器
├── game.ts                    # 遊戲狀態處理器
├── map_choose.ts              # 地圖選擇處理器
├── kill.ts                    # 擊殺事件處理器
├── damage.ts                  # 傷害事件處理器
├── player_online_status.ts    # 玩家上線狀態處理器
├── player_info.ts             # 玩家資訊處理器
└── output_win.ts              # 遊戲勝負結果處理器
```

## 處理器規範

每個處理器檔案必須遵循以下規範：

1. **匯出 action**: 檔案必須匯出對應的 Action
2. **匯出 handler**: 檔案必須匯出名為 `{filename}Handler` 的處理器函數
3. **實作 Handler 介面**: 處理器函數必須實作 `Handler` 介面

### 範例檔案結構

```typescript
// example.ts
import { Action, WebSocketError } from '../../types';
import type { Handler } from './types';

export const action = Action.example;

export const exampleHandler: Handler = async ({ ws, message, client, logger }) => {
    // 處理邏輯
};
```

## 動態載入系統

系統啟動時會：

1. 掃描 handlers 目錄中的所有 `.ts` 檔案
2. 動態匯入每個檔案
3. 檢查檔案是否匯出 `action` 和對應的 handler 函數
4. 建立 action 到 handler 的映射
5. 記錄載入成功/失敗的處理器

### 載入日誌範例

```
✓ Loaded handler: handshake from handshake.ts
✓ Loaded handler: heartbeat from heartbeat.ts
⚠ Handler function 'exampleHandler' not found in example.ts
✗ Failed to load handler from broken.ts: SyntaxError
Loaded 16 handlers
```

## 錯誤處理

### 處理器載入錯誤

- 如果檔案無法匯入，會記錄錯誤並繼續載入其他檔案
- 如果檔案沒有匯出 `action`，會記錄警告
- 如果檔案沒有匯出對應的 handler 函數，會記錄警告

### 處理器執行錯誤

```typescript
// 錯誤會包含詳細資訊
{
    action: 'handshake',
    handlerFile: 'handshake.ts',
    error: 'Client not found'
}
```

## 使用方式

在主要的 WebSocket 訊息處理中：

```typescript
const handled = await handleMessage({
    ws,
    message: parsedMessage,
    client,
    clients,
    logger,
    server,
    queueManager,
});

if (!handled) {
    // 處理未知的 action
}
```

## 管理功能

### 獲取已載入的處理器

```typescript
import { getLoadedHandlers } from './handlers';

const handlers = getLoadedHandlers();
// 回傳: { 'handshake': 'handshake.ts', 'heartbeat': 'heartbeat.ts', ... }
```

### 重新載入處理器

```typescript
import { reloadHandlers } from './handlers';

await reloadHandlers();
```

## 新增處理器

要新增新的處理器：

1. 在 `handlers/` 資料夾中建立新檔案 `new_action.ts`
2. 實作以下內容：

```typescript
import { Action, WebSocketError } from '../../types';
import type { Handler } from './types';

export const action = Action.new_action;

export const new_actionHandler: Handler = async (context) => {
    // 你的處理邏輯
};
```

3. 重新啟動應用程式，系統會自動載入新的處理器

## 優點

1. **完全自動化**: 新增處理器只需建立檔案，無需手動註冊
2. **錯誤可見性**: 載入失敗的處理器會被明確記錄
3. **開發友善**: 清楚的命名規範和載入日誌
4. **型別安全**: 完整的 TypeScript 支援
5. **易於維護**: 每個功能都有獨立的檔案
6. **Hot reload 準備**: 支援動態重新載入（未來功能）
