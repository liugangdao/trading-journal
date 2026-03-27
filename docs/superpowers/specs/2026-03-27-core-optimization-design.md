# 核心功能优化 — 设计文档

## 概述

对 trading-journal 现有核心功能进行三方面优化：

1. **日期时间增强**：精确到分钟，开仓/平仓时间分开记录
2. **筛选 + 分页**：交易列表支持按日期/品种/方向筛选，后端分页
3. **统计分析增强**：周对比、滚动趋势、交叉分析表优化、连胜连亏追踪

## 1. 日期时间增强

### 数据库变更

`trades` 表字段变更：

| 旧字段 | 新字段 | 类型 | 说明 |
|--------|--------|------|------|
| `date` | `open_time` | TEXT | 格式 `YYYY-MM-DDTHH:mm`，开仓时间 |
| （无） | `close_time` | TEXT | 格式 `YYYY-MM-DDTHH:mm`，平仓时填写 |

### 数据迁移

在 `server/db.js` inline migration 中执行（和现有迁移模式一致）：

1. 检查 `trades` 表是否有 `date` 列（无 `open_time` 列）
2. 如有，执行迁移：
   - 新建 `trades_new` 表（`open_time` 替代 `date`，新增 `close_time`）
   - `INSERT INTO trades_new ... SELECT ... date || 'T00:00' AS open_time, NULL AS close_time ... FROM trades`
   - 删除旧表，重命名新表

### 前端变更

- **TradeForm**：开仓 `type="date"` → `type="datetime-local"`，label 改"开仓时间"。平仓时新增"平仓时间"字段（`datetime-local`，默认当前时间 `YYYY-MM-DDTHH:mm`）
- **TradeTable**：日期列显示 `MM/DD HH:mm`（从 `open_time` 提取），hover title 显示完整时间
- **OpenPositions**：显示持仓时长（`close_time` 或当前时间 - `open_time`），格式"X天Y小时"或"X小时Y分钟"

### 导入兼容

`/api/import` 端点处理旧格式数据时：如果记录有 `date` 字段但无 `open_time`，自动映射 `date + "T00:00"` → `open_time`。

### 连锁影响

以下位置的 `t.date` / `date` 引用需全部替换为 `open_time`：

- `calc.js`：`weekday(t.date)` → `weekday(t.open_time)`，排序 `a.date.localeCompare` → `a.open_time.localeCompare`
- `server/routes/trades.js`：POST/PUT 字段名、sort 允许列表（`date` → `open_time`）、默认排序字段
- `Dashboard.jsx`：cumData 的 date 字段来源
- `TradeTable.jsx`：所有 `t.date` 引用
- `OpenPositions.jsx`：同上
- `PsychologyPanel.jsx`：今日筛选逻辑（按 `open_time` 的日期部分匹配）
- `WeeklyNotes.jsx`：按 ISO week 分组（取 `open_time` 的日期部分）
- `ExportBar.jsx`：导出日期范围筛选
- 导出 JSON 格式：字段名从 `date` 变为 `open_time`，新增 `close_time`

## 2. 筛选 + 分页

### 后端 API 变更

`GET /api/trades` 新增查询参数：

```
?limit=20           每页条数，不传则返回全量（向后兼容）。前端分页请求显式传 limit=20
&offset=0           分页偏移，不传默认 0
&date_from=         开仓时间起，格式 YYYY-MM-DD（包含当天）
&date_to=           开仓时间止，格式 YYYY-MM-DD（包含当天）
&pair=              品种，精确匹配
&direction=         方向，精确匹配（多(Buy) 或 空(Sell)）
&sort=open_time     排序字段
&order=desc         排序方向
```

返回格式变更：

```json
{
  "trades": [...],
  "total": 247,
  "limit": 20,
  "offset": 0
}
```

当 `limit` 未传时，返回全量数据（`total` = 数组长度，`offset` = 0）。这保证 Dashboard 和导出等需要全量数据的场景无需改动接口。

SQL 构建：在 JavaScript 中动态拼接 WHERE 子句（better-sqlite3 不支持 `? IS NULL` 模式）：

```javascript
const conditions = ['user_id = ?']
const params = [userId]

if (date_from) {
  conditions.push('open_time >= ?')
  params.push(date_from + 'T00:00')
}
if (date_to) {
  conditions.push('open_time <= ?')
  params.push(date_to + 'T23:59')
}
if (pair) {
  conditions.push('pair = ?')
  params.push(pair)
}
if (direction) {
  conditions.push('direction = ?')
  params.push(direction)
}

const where = conditions.join(' AND ')
const countResult = db.prepare(`SELECT COUNT(*) as total FROM trades WHERE ${where}`).get(...params)
const trades = db.prepare(`SELECT * FROM trades WHERE ${where} ORDER BY ${sortCol} ${order}, id ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset)
```

当 `limit` 未传时，不添加 LIMIT/OFFSET 子句。

排序允许列表更新：`['id', 'open_time', 'pair', 'gross_pnl', 'created_at']`。

### 前端筛选栏

在交易记录 Tab（record）顶部新增 `TradeFilter` 组件：

```
┌──────────────────────────────────────────────────────┐
│ [今天] [本周] [本月] [全部]    品种 [全部 ▼]  方向 [全部 ▼] │
└──────────────────────────────────────────────────────┘
```

- 快捷按钮互斥，高亮当前选中
- "今天"：`date_from = date_to = 今天`
- "本周"：`date_from = 本周一`, `date_to = 本周日`
- "本月"：`date_from = 本月1日`, `date_to = 本月最后一天`
- "全部"：不传 date_from/date_to（默认）
- 品种下拉从用户的 pairs 列表生成，首项"全部"
- 方向下拉：全部 / 多(Buy) / 空(Sell)
- 筛选条件变化时自动重新请求第 1 页

移动端适配：快捷按钮横向排列不换行（可滚动）。品种/方向收进一个"筛选"图标按钮，点击展开下拉面板。

### 前端分页栏

在 TradeTable 底部新增分页组件：

```
共 247 笔交易  ‹ 1 2 3 ... 13 ›  每页 20 笔
```

- 每页固定 20 笔
- 页码超过 7 页时用省略号压缩
- 移动端简化为 `‹ 3/13 ›`
- 当前页高亮

### App.jsx 状态变更

```javascript
// 分页交易（给 TradeTable）
const [pagedTrades, setPagedTrades] = useState([])
const [tradePagination, setTradePagination] = useState({ total: 0, limit: 20, offset: 0 })

// 筛选条件
const [tradeFilter, setTradeFilter] = useState({ date_from: null, date_to: null, pair: null, direction: null })

// 全量交易（给 Dashboard + calcStats）
const [allTrades, setAllTrades] = useState([])
```

- `pagedTrades`：带筛选+分页参数请求，给 TradeTable
- `allTrades`：不带 limit/offset 请求（或 limit=0），给 Dashboard 和 PsychologyPanel
- 筛选条件变化时重新请求 pagedTrades（offset 重置为 0）
- 新增/编辑/删除交易后同时刷新 pagedTrades 和 allTrades
- 切到 stats Tab 时如果 allTrades 已有数据则不重新请求

## 3. 统计分析增强

### 3.1 KPI 卡片对比

现有 6 个 KPI 卡片（总交易数、胜率、净盈亏、盈亏比、平均R、执行合格率）增加对比行。

对比逻辑（Stats Tab 固定行为，不依赖 Record Tab 筛选）：
- 固定显示"本周 vs 上周"对比
- 从 `allTrades` 中按 ISO week 过滤出本周和上周的交易，分别计算统计
- 如果本周无交易，对比行不显示

显示格式：
- 胜率 58% `↑ vs上周 52%` — 绿色箭头
- 净盈亏 $1,200 `↓ vs上周 $1,800` — 红色箭头
- 平均R 1.5 `→ vs上周 1.48` — 灰色箭头（差值 < 5%）

KpiCard 组件扩展：新增可选 `comparison` prop（`{ value, label, direction }`）。

### 3.2 连胜连亏 KPI（新增 3 个卡片）

在现有 KPI 行下方新增一行：

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 当前连续      │ │ 最大连胜      │ │ 最大回撤     │
│ 连亏 2 笔 🔴 │ │ 5 笔         │ │ -$1,850     │
└─────────────┘ └─────────────┘ └─────────────┘
```

- **当前连续**：从最近一笔交易往前数，连续盈利或亏损的笔数。连亏红色背景、连胜绿色背景
- **最大连胜**：历史最长连续盈利笔数
- **最大回撤**：按 `open_time` 排序计算累计 netPnl 权益曲线，取 peak-to-trough 最大跌幅（绝对值，显示为负数）

这三个指标受 Dashboard 筛选条件影响（如果未来 Dashboard 加了自己的筛选）。当前版本基于 allTrades 全量计算。

### 3.3 滚动趋势图（新增）

在 KPI 行下方、累计盈亏曲线上方，新增两张趋势图并排：

- **左：周胜率趋势**（Recharts LineChart）— 最近 8 个 ISO week 的胜率折线
- **右：周净盈亏趋势**（Recharts BarChart）— 最近 8 周的净盈亏柱状图，正值绿色、负值红色

数据来源：从 `allTrades` 按 ISO week 分组（取 `open_time` 的日期部分计算 ISO week），固定最近 8 周（含无交易的空周显示为 0），不受筛选条件影响。

移动端：两张图上下排列（而非左右）。

### 3.4 交叉分析表优化

现有 Dashboard 已有 4 张分析表（策略/星期/周期/情绪）。优化而非新增：

**改动：**
- 改为可折叠（Disclosure 组件），点击标题行展开/收起
- 桌面端默认展开前 2 个，移动端默认全部折叠
- 排列顺序调整为：情绪分析 → 策略分析 → 品种分析 → 星期分析 → 周期分析
- 品种分析目前是柱状图（`品种盈亏分布`），改为和其他分析表统一的表格格式，柱状图移除
- 情绪分析目前是饼图（`情绪分布`），改为表格格式，饼图移除
- 交易数少于 2 笔的行文字颜色降为 muted（样本太少不具参考性）

**统一表格结构：**

| 名称 | 交易数 | 胜率 | 净盈亏 | 平均R |
|------|--------|------|--------|-------|
| ... | ... | ... | ... | ... |

每张表按净盈亏降序排列。

## 4. R 倍数计算修正

### 当前问题

`calc.js` 中 R 倍数计算完全依赖 `gross_pnl / pnlPips` 反推 `dollarPerPip`，忽略了 `risk_amount` 字段。当 `pnlPips` 很小时（微利出场），`dollarPerPip` 极大导致 R 值失真。`rMultiple = 0` 时无法区分"R 为零"和"无法计算"。

### 修正后的逻辑

```javascript
// risk_amount 优先（用户录入的实际风险金额）
const riskDollars = parseFloat(t.risk_amount) > 0
  ? parseFloat(t.risk_amount)
  : (stopPips > 0 && dollarPerPip > 0 ? stopPips * dollarPerPip : 0)

const rMultiple = riskDollars > 0 ? netPnl / riskDollars : null
```

- `rMultiple = null` 表示"无法计算"
- `calcStats()` 中计算平均 R 时排除 `rMultiple === null` 的交易（不计入分母）
- UI 中 `null` 显示为 `—`（短横线）

### netPnl 计算确认

维持现有逻辑不变：`netPnl = gross_pnl + swap`。

`gross_pnl` 是券商数字（已含点差），`spread` 字段仅作参考展示。设计文档和代码保持一致。

## 5. 页面布局

### 交易记录 Tab（record）

```
┌─ TradeFilter 筛选栏 ──────────────────────────┐
│ [今天] [本周] [本月] [全部]  品种[▼]  方向[▼]   │
└───────────────────────────────────────────────┘
┌─ PsychologyPanel（已有）─────────────────────┐
│ 今日成本 / 历史胜率 / 错过交易                   │
└───────────────────────────────────────────────┘
┌─ TradeForm（已有，datetime-local）────────────┐
│ 开仓时间 / 品种 / 方向 / 策略 / ...            │
└───────────────────────────────────────────────┘
┌─ OpenPositions（已有，加持仓时长）──────────────┐
│ XAUUSD 多 2650.00  止损2640  持仓 2天3小时      │
└───────────────────────────────────────────────┘
┌─ TradeTable（改造：分页 + 受筛选影响）──────────┐
│ 表格 20 笔/页                                   │
│ 共 247 笔  ‹ 1 2 3 ... 13 ›                    │
└───────────────────────────────────────────────┘
```

### 统计 Tab（stats）

```
┌─ KPI 卡片行 1（已有 6 个，加对比箭头）────────────┐
│ 总交易数 / 胜率↑ / 净盈亏↓ / 盈亏比 / 平均R / 合格率│
└──────────────────────────────────────────────────┘
┌─ KPI 卡片行 2（新增 3 个）───────────────────────┐
│ 当前连续 / 最大连胜 / 最大回撤                      │
└──────────────────────────────────────────────────┘
┌─ 趋势图（新增，并排）──────────────────────────────┐
│ [周胜率折线 8周]              [周盈亏柱状图 8周]     │
└──────────────────────────────────────────────────┘
┌─ 累计盈亏曲线（已有）──────────────────────────────┘
└──────────────────────────────────────────────────┘
┌─ 交叉分析（优化现有，可折叠）─────────────────────┐
│ ▼ 情绪分析表                                      │
│ ▼ 策略分析表                                      │
│ ▶ 品种分析表                                      │
│ ▶ 星期分析表                                      │
│ ▶ 周期分析表                                      │
└──────────────────────────────────────────────────┘
┌─ 违规分析（已有）───────────────────────────────┐
└──────────────────────────────────────────────────┘
```

### 筛选条件作用范围

- 筛选栏在 record Tab 显示，控制 TradeTable 的数据
- stats Tab 无独立筛选器，基于 allTrades 全量计算
- KPI 对比固定显示"本周 vs 上周"，不依赖 Record Tab 的筛选状态
- 趋势图固定最近 8 周，不受任何筛选影响

## 6. 新增组件清单

| 组件 | 文件 | 职责 |
|------|------|------|
| TradeFilter | `client/src/components/TradeFilter.jsx` | 筛选栏（快捷按钮 + 品种 + 方向下拉） |
| Pagination | `client/src/components/ui/Pagination.jsx` | 分页组件（页码 + 总数显示） |
| Disclosure | `client/src/components/ui/Disclosure.jsx` | 可折叠面板（标题 + 展开/收起） |
| WeeklyTrend | `client/src/components/WeeklyTrend.jsx` | 趋势图（周胜率折线 + 周盈亏柱状） |
| StreakKpis | `client/src/components/StreakKpis.jsx` | 连胜连亏 + 最大回撤 KPI 行 |

## 7. 修改文件清单

| 文件 | 改动 |
|------|------|
| `server/db.js` | 新增 migration：`date` → `open_time`，新增 `close_time` |
| `server/routes/trades.js` | 分页+筛选参数解析，返回格式改为 `{ trades, total, limit, offset }`，字段名更新 |
| `client/src/lib/calc.js` | R 倍数修正（risk_amount 优先），新增 streak/drawdown/weeklyTrend 计算，`date` → `open_time` |
| `client/src/App.jsx` | 新增 pagedTrades/allTrades/tradeFilter/tradePagination state，请求逻辑拆分 |
| `client/src/components/TradeForm.jsx` | `date` → `open_time` datetime-local，新增 `close_time` 字段 |
| `client/src/components/TradeTable.jsx` | 接收 pagedTrades，日期显示格式改 MM/DD HH:mm |
| `client/src/components/OpenPositions.jsx` | 显示持仓时长 |
| `client/src/components/Dashboard.jsx` | KPI 对比行，趋势图区域，交叉分析表改可折叠，移除品种柱状图和情绪饼图 |
| `client/src/components/PsychologyPanel.jsx` | `t.date` → `t.open_time` |
| `client/src/components/ExportBar.jsx` | 导出字段名更新 |
| `client/src/hooks/useApi.js` | getTrades 支持 query 参数传递 |
| `server/routes/import.js`（或 export.js） | 导入时 `date` → `open_time` 兼容映射 |
