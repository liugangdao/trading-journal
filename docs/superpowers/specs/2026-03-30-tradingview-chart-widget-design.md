# TradingView 实时图表 Widget

## 概述

在交易记录 tab 的持仓卡片上方嵌入 TradingView Advanced Chart Widget（iframe），让用户在管理持仓的同时查看实时行情。

## 需求

### 核心行为

- 始终显示：不论是否有持仓，图表区域常驻
- 桌面端专属：手机端隐藏（`hidden md:block`）
- 默认品种：首次加载 `FX:EURUSD`，后续由 TradingView Widget 自身记住用户上次查看的品种
- 无额外 UI 控件：品种切换、时间周期、技术指标等操作全部在 Widget iframe 内完成

### 不做

- 不根据持仓品种自动切换 Widget 显示的 symbol
- 不自建图表控件或工具栏
- 不做手机端图表适配

## 技术方案

### 组件

新建 `client/src/components/TradingViewChart.jsx`：

- 使用 TradingView [Advanced Chart Widget](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/) 的嵌入方式
- Widget 通过 TradingView 官方 `<script>` 注入方式加载（创建 container div，插入 widget script），最终渲染为 iframe
- 组件挂载时初始化 Widget，卸载时清理

### Widget 配置参数

| 参数 | 值 | 说明 |
|------|------|------|
| `symbol` | `FX:EURUSD` | 默认品种 |
| `theme` | `dark` | 匹配应用暗色主题 |
| `autosize` | `true` | 自适应容器宽度 |
| `height` | `400` | 固定高度 400px |
| `style` | `1` | K 线图样式 |
| `locale` | `zh_CN` | 中文界面 |
| `allow_symbol_change` | `true` | 允许用户在 Widget 内切换品种 |
| `hide_side_toolbar` | `false` | 保留侧边绘图工具 |

### 放置位置

在 `App.jsx` 的交易记录 tab 中，插入到 `OpenPositions` 组件之前：

```
PsychologyPanel
TradingViewChart    ← 新增
OpenPositions
TradeForm
TradeTable
```

### 样式

- 外层容器：`rounded-xl overflow-hidden mb-4 hidden md:block`
- 高度：400px
- 与现有 `bg-card` / `border-border` 卡片风格统一
- 圆角 12px，与持仓卡片一致

### 响应式

- 桌面端（`md` 及以上）：显示，宽度跟随父容器
- 手机端（`md` 以下）：`hidden`，完全不渲染 iframe

## 影响范围

- 新增文件：`client/src/components/TradingViewChart.jsx`
- 修改文件：`App.jsx`（引入组件，在 record tab 桌面端和移动端渲染位置插入）
- 无后端改动
- 无数据库改动
- 无新依赖（TradingView Widget 通过 CDN script 加载）
