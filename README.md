# Trading Journal / 交易手记

面向突破与趋势延续交易的轻量手记。每笔交易先记判断，结束后补结果与执行评价，重点关注交易过程。

## 使用流程

1. 在“记录”填写时间、品种、方向、市场环境、Setup、入场理由和失效条件。入场理由与失效条件必填，退出原因在结束交易时补充。
2. 交易结束后编辑该笔记录，选择结构止损、移动止损、measured move目标或手动平仓，可同时填写 R 和美元盈亏，也可只填其中一项。执行评价可多选：计划内、FOMO、追涨杀跌、提前平仓、移动止损过早、逆势、未等收盘确认；提前或手动平仓时需要写明原因，最后回答“遮住盈亏仍是好交易吗？”
3. 在记录表单直接粘贴截图（Ctrl+V）或选择图片。每笔最多 8 张，每张不超过 5 MB，支持 PNG、JPEG、WebP。
4. “交易记录”保留旧版完整明细与持仓，支持按顺序逐笔复盘：截图在上、交易说明在下；点击“编辑这笔交易”可在复盘页内修改。
5. “日历”按天分别显示交易笔数、R 与美元盈亏。“统计”突出胜率、平均盈利 R、平均亏损 R、期望值和违规率，并显示按日的期望曲线；原有美元分析仍可查看，累计净盈亏按交易日合并。
6. 在“设置”按周写目标；当前周目标会显示在记录表单上方。品种管理可折叠，默认提供 XAUUSD、EURUSD、USDCAD、BTCUSD、USOIL，支持自行增删改；也可导入导出 JSON。

旧周度复盘、月度复盘及交易政策不再提供页面入口；旧数据及兼容接口保留。旧交易可从原有明细表查看、编辑和平仓。TradingView K 线块已移除。

## 技术栈

React 19、Vite 7、Tailwind CSS v4、Express 5、SQLite（better-sqlite3）。登录采用服务端会话，交易、目标和截图按用户隔离。截图作为 BLOB 保存在同一 SQLite 数据库中，随持久化卷保存；JSON 导出包含截图和周目标。

## 本地运行

```bash
npm run install:all
npm run dev
```

前端地址为 `http://localhost:3000/`，后端地址为 `http://localhost:3001/`。开发模式下 Vite 将 `/api` 请求代理到后端。生产构建使用 `npm run build`，Docker 可使用 `docker compose up -d`。数据库位于 `data/journal.db`，部署时须将 `/app/data` 挂载为持久化卷。

## 主要接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/journal?month=YYYY-MM` | 按月读取交易和图片数量 |
| POST/PUT/DELETE | `/api/journal`、`/api/journal/:id` | 新建、更新、删除轻量交易 |
| GET/POST | `/api/journal/:id/images` | 列出、上传交易截图 |
| GET/DELETE | `/api/journal/:id/images/:imageId` | 查看、删除截图 |
| GET/PUT | `/api/journal/goals/:week` | 读取、保存周目标，周格式为 `YYYY-Www` |
| GET/POST | `/api/export`、`/api/import` | JSON 导出、导入 |

旧版 `/api/trades`、复盘和政策接口继续保留以兼容历史数据；新页面不再调用旧复盘与政策接口。
