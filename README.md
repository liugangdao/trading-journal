# Trading Journal / 交易手记

面向突破与趋势延续交易的轻量手记。每笔交易先记判断，结束后补结果与执行评价，重点关注交易过程。

## 使用流程

1. 在“记录”填写时间、品种、方向、市场环境、Setup、入场理由和失效条件。入场理由与失效条件必填，退出原因在结束交易时补充。
2. 交易结束后编辑该笔记录，选择结构止损、移动止损、measured move目标或手动平仓，可同时填写 R 和美元盈亏，也可只填其中一项。执行评价可多选：计划内、FOMO、追涨杀跌、提前平仓、移动止损过早、逆势、未等收盘确认；提前或手动平仓时需要写明原因，最后回答“遮住盈亏仍是好交易吗？”
3. 在记录表单直接粘贴截图（Ctrl+V）或选择图片。每笔最多 8 张，每张不超过 5 MB，支持 PNG、JPEG、WebP。
4. “交易记录”保留旧版完整明细与持仓，支持按顺序逐笔复盘：截图在上、交易说明在下；点击“编辑这笔交易”可在复盘页内修改。
5. “日历”按天分别显示交易笔数、R 与美元盈亏。“统计”突出胜率、平均盈利 R、平均亏损 R、期望值和违规率，并显示按日的期望曲线；原有美元分析仍可查看，累计净盈亏按交易日合并。
6. 在“设置”按周写目标；当前周目标会显示在记录表单上方。品种管理可折叠，默认提供 XAUUSD、EURUSD、USDCAD、BTCUSD、USOIL，支持自行增删改；也可导入导出 JSON。
7. 如使用 Hyperliquid 主网默认永续市场，可在“设置 → Hyperliquid 永续持仓同步”绑定实际交易账户的公开地址。页面打开时约每 30 秒读取一次当前仓位与成交；加仓、部分平仓和完全平仓会更新同一条记录，反手会开启新记录。复盘文字、标签、R 与截图仍手工填写。

Hyperliquid 同步只读取公开数据，不需要私钥，也不能下单。首次绑定只导入当时未平的仓位；此前已经结束的交易不会自动导入。美元结果采用已观察成交的 `closedPnl` 减去已观察手续费，单位为 USDC，不包含资金费；接入前已有仓位的开仓时间与历史手续费可能不完整。关闭页面后，下次打开会尝试补齐官方接口仍可查询的成交；超出查询范围或仓位对不上时会暂停并提示核对。解绑保留历史同步记录，并将旧持仓标为“同步已停止”；重新绑定同一地址会从新的当前持仓开始。

若本机只能通过 HTTP 代理访问 Hyperliquid，启动脚本在检测到 `HTTPS_PROXY` 时会为 Node 自动启用环境代理；此功能需要 Node 24.5+，并保留证书校验。修改启动脚本后需重新运行 `npm run dev`。其他部署环境可以直接联网；Docker 当前使用 Node 20，若也必须走代理，需要单独配置兼容的代理方案。

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
| GET/PUT/DELETE、POST | `/api/hyperliquid`、`/api/hyperliquid/sync` | 当前登录账号的只读绑定、解绑、状态和同步 |

旧版 `/api/trades`、复盘和政策接口继续保留以兼容历史数据；新页面不再调用旧复盘与政策接口。
