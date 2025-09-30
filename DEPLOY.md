# 部署指南 / Deployment Guide

## 🚀 完整部署步驟

### 1. 準備工作

```bash
# 安裝 Wrangler CLI
npm install -g wrangler

# 登入 Cloudflare
wrangler login
```

### 2. 創建 KV 命名空間

```bash
# 創建生產環境 KV 命名空間
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "TOKENS"

# 創建預覽環境 KV 命名空間
wrangler kv:namespace create "CACHE" --preview
wrangler kv:namespace create "TOKENS" --preview
```

記下返回的 namespace IDs，更新到 `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-namespace-id"          # 替換為實際 ID
preview_id = "your-cache-preview-id"    # 替換為實際預覽 ID

[[kv_namespaces]]
binding = "TOKENS"  
id = "your-tokens-namespace-id"         # 替換為實際 ID
preview_id = "your-tokens-preview-id"   # 替換為實際預覽 ID
```

### 3. 設置環境變數

```bash
# 設置 Amazing Marvin API 金鑰
wrangler secret put AMAZING_MARVIN_API_KEY
# 輸入: 你的 Amazing Marvin API 金鑰

# 設置 OAuth 客戶端密鑰 (生成隨機字符串)
wrangler secret put OAUTH_CLIENT_SECRET
# 輸入: 隨機生成的 UUID (可用 crypto.randomUUID() 生成)

# 設置 JWT 密鑰
wrangler secret put JWT_SECRET
# 輸入: 隨機生成的字符串 (建議 32+ 字符)
```

### 4. 部署

```bash
# 開發環境測試
npm run dev

# 部署到生產環境
npm run deploy

# 或部署到測試環境
wrangler deploy --env staging
```

### 5. 驗證部署

訪問你的 Worker URL:
```
https://your-worker-name.your-subdomain.workers.dev
```

應該看到服務資訊頁面。

## 🔧 配置 Claude

### 桌面版 Claude

在 `claude_desktop_config.json` 添加:

```json
{
  "mcpServers": {
    "amazing-marvin-remote": {
      "command": "node",
      "args": ["-e", "console.log('Remote MCP servers not supported in desktop')"],
      "env": {}
    }
  }
}
```

**注意**: 桌面版不支援遠端 MCP，請使用網頁版設置。

### 網頁版和手機版 Claude

1. 前往 [Claude.ai](https://claude.ai)
2. 點擊 Settings → Connectors
3. 點擊 "Add Custom Connector"
4. 填入資訊:
   - **Name**: Amazing Marvin
   - **URL**: `https://your-worker-name.your-subdomain.workers.dev`
5. 點擊 "Connect"
6. 在授權頁面輸入你的 Amazing Marvin API 金鑰
7. 完成授權流程

## 🧪 測試功能

### 基本連接測試

```
Hey Claude, can you get my daily productivity overview using Amazing Marvin?
```

### 創建任務測試

```
Claude, create a task "Test remote MCP" scheduled for today using Amazing Marvin.
```

### 分析測試

```
Claude, show me my productivity summary from Amazing Marvin.
```

## 🛠️ 故障排除

### 常見問題

1. **KV Namespace 錯誤**
   ```
   Error: KV namespace binding "CACHE" not found
   ```
   - 檢查 wrangler.toml 中的 namespace IDs
   - 確保已創建 KV 命名空間

2. **認證失敗**
   ```
   Error: Invalid or expired token
   ```
   - 重新設置 JWT_SECRET
   - 在 Claude 中重新授權連接器

3. **API 金鑰無效**
   ```
   Error: Marvin API error: 401 Unauthorized
   ```
   - 檢查 Amazing Marvin API 金鑰是否正確
   - 確認 API 金鑰有適當權限

### 調試模式

啟用調試模式:
```bash
wrangler secret put DEBUG_MODE
# 輸入: true
```

查看日誌:
```bash
wrangler tail
```

## 🔄 更新部署

```bash
# 拉取最新代碼
git pull origin main

# 安裝依賴
npm install

# 重新部署
npm run deploy
```

## 📊 監控

### Cloudflare Dashboard

1. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 選擇你的帳戶
3. 點擊 "Workers & Pages"
4. 找到你的 Worker
5. 查看指標和日誌

### 可用指標

- 請求數量
- 錯誤率
- 響應時間
- KV 使用情況

## 🔐 安全設置

### 建議的安全措施

1. **定期輪換密鑰**
   ```bash
   wrangler secret put OAUTH_CLIENT_SECRET  # 更新新密鑰
   wrangler secret put JWT_SECRET           # 更新新密鑰
   ```

2. **監控使用情況**
   - 定期檢查 Cloudflare 日誌
   - 監控異常請求模式

3. **域名設置**
   - 考慮使用自定義域名
   - 設置適當的 CORS 政策

## 💡 優化建議

### 性能優化

1. **緩存策略**
   - 調整 CACHE_TTL 根據使用模式
   - 考慮實施更智能的緩存失效

2. **請求優化**
   - 批量處理相關請求
   - 使用並發請求減少延遲

### 成本優化

1. **Cloudflare Workers**
   - 免費計劃: 每天 100,000 請求
   - 付費計劃: $5/月 + $0.50/百萬請求

2. **KV 存儲**
   - 免費計劃: 每天 100,000 讀取，1,000 寫入
   - 根據使用情況調整緩存策略

---

**部署成功後，你就可以在 Claude 手機 app 中使用 Amazing Marvin 功能了！**