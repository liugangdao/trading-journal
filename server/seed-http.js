const BASE = 'http://localhost:3001/api'

// Closed trades
const closedTrades = [
  {date:"2026-02-10",pair:"EUR/USD",direction:"多(Buy)",strategy:"趋势跟踪",timeframe:"H4",lots:0.5,entry:1.0325,stop:1.0295,target:1.04,exit_price:1.0372,gross_pnl:235,swap:-2.5,score:"A-完美执行",emotion:"冷静理性",notes:"趋势明确，回调至支撑位入场，严格执行计划",status:"closed"},
  {date:"2026-02-11",pair:"GBP/USD",direction:"空(Sell)",strategy:"通道突破",timeframe:"H1",lots:0.3,entry:1.265,stop:1.269,target:1.258,exit_price:1.2595,gross_pnl:165,swap:1.2,score:"B-基本执行",emotion:"冷静理性",notes:"通道上轨做空，目标未完全到达提前止盈",status:"closed"},
  {date:"2026-02-12",pair:"XAU/USD",direction:"多(Buy)",strategy:"回调入场",timeframe:"H4",lots:0.2,entry:2025.5,stop:2018,target:2045,exit_price:2042.3,gross_pnl:336,swap:-5.8,score:"A-完美执行",emotion:"略有紧张",notes:"金价回调至前期支撑2025附近入场",status:"closed"},
  {date:"2026-02-13",pair:"USD/JPY",direction:"多(Buy)",strategy:"形态交易",timeframe:"M30",lots:0.4,entry:149.85,stop:149.55,target:150.3,exit_price:149.62,gross_pnl:-92,swap:0,score:"C-有偏差",emotion:"恐惧犹豫",notes:"双底形态未确认就急于进场，止损出局",status:"closed"},
  {date:"2026-02-14",pair:"AUD/USD",direction:"空(Sell)",strategy:"技术+基本面",timeframe:"D1",lots:0.3,entry:0.635,stop:0.6385,target:0.628,exit_price:0.6288,gross_pnl:186,swap:3.5,score:"B-基本执行",emotion:"冷静理性",notes:"澳联储偏鸽叠加技术面破位",status:"closed"},
  {date:"2026-02-17",pair:"EUR/GBP",direction:"多(Buy)",strategy:"均值回归",timeframe:"H4",lots:0.2,entry:0.832,stop:0.8295,target:0.836,exit_price:0.8355,gross_pnl:70,swap:-1,score:"B-基本执行",emotion:"冷静理性",notes:"价格偏离均线过远，均值回归做多",status:"closed"},
  {date:"2026-02-18",pair:"GBP/JPY",direction:"多(Buy)",strategy:"趋势跟踪",timeframe:"H1",lots:0.2,entry:188.5,stop:187.8,target:189.8,exit_price:187.9,gross_pnl:-120,swap:0,score:"D-严重违规",emotion:"报复心态",notes:"前一笔亏损后急于回本，报复性交易",status:"closed"},
  {date:"2026-02-19",pair:"XAU/USD",direction:"空(Sell)",strategy:"通道突破",timeframe:"H4",lots:0.15,entry:2058,stop:2065,target:2038,exit_price:2040.5,gross_pnl:262.5,swap:-3.2,score:"A-完美执行",emotion:"冷静理性",notes:"黄金触及通道上轨后反转做空",status:"closed"},
  {date:"2026-02-20",pair:"USD/CAD",direction:"多(Buy)",strategy:"基本面驱动",timeframe:"D1",lots:0.4,entry:1.358,stop:1.354,target:1.365,exit_price:1.3642,gross_pnl:248,swap:2,score:"B-基本执行",emotion:"略有紧张",notes:"加拿大就业数据不及预期，美加做多",status:"closed"},
  {date:"2026-02-21",pair:"EUR/USD",direction:"空(Sell)",strategy:"趋势跟踪",timeframe:"H4",lots:0.5,entry:1.041,stop:1.0445,target:1.035,exit_price:1.0365,gross_pnl:225,swap:-1.8,score:"B-基本执行",emotion:"冷静理性",notes:"欧元下行趋势延续，反弹做空",status:"closed"},
  {date:"2026-02-24",pair:"NZD/USD",direction:"多(Buy)",strategy:"回调入场",timeframe:"H1",lots:0.3,entry:0.572,stop:0.5695,target:0.577,exit_price:0.5685,gross_pnl:-105,swap:0,score:"C-有偏差",emotion:"贪婪冲动",notes:"看到快速下跌想抄底，没有等到信号确认",status:"closed"},
  {date:"2026-02-25",pair:"USOil",direction:"多(Buy)",strategy:"技术+基本面",timeframe:"H4",lots:0.2,entry:72.5,stop:71.8,target:74,exit_price:73.65,gross_pnl:230,swap:-4,score:"A-完美执行",emotion:"冷静理性",notes:"EIA库存大减叠加技术面突破，原油做多",status:"closed"},
]

// Open trades (no exit_price/gross_pnl)
const openTrades = [
  {date:"2026-02-25",pair:"GBP/USD",direction:"多(Buy)",strategy:"趋势跟踪",timeframe:"H4",lots:0.3,entry:1.267,stop:1.263,target:1.275,emotion:"冷静理性",notes:"英镑回调至4H支撑位，趋势延续做多",status:"open"},
  {date:"2026-02-25",pair:"XAU/USD",direction:"空(Sell)",strategy:"通道突破",timeframe:"H1",lots:0.15,entry:2045,stop:2052,target:2030,emotion:"略有紧张",notes:"金价触及通道上轨，等待反转信号后做空",status:"open"},
  {date:"2026-02-25",pair:"USD/JPY",direction:"多(Buy)",strategy:"技术+基本面",timeframe:"H4",lots:0.2,entry:150.2,stop:149.7,target:151.5,emotion:"冷静理性",notes:"美日利差扩大叠加技术面突破，做多",status:"open"},
]

const notes = [
  {week:"2026-W07",lesson:"报复性交易是最大敌人。GBP/JPY那笔亏损完全是因为前一笔止损后情绪失控。\n\n规则：连续亏损2笔后强制休息4小时。",plan:"1. 严格执行4小时冷静期规则\n2. 每笔交易前写下入场理由\n3. 重点关注A级执行率，目标>60%"},
  {week:"2026-W08",lesson:"本周胜率提升到75%，主要得益于只做高确认度信号。黄金和原油的基本面+技术面共振策略表现最好。\n\n抄底NZD/USD的教训：不要在下跌趋势中逆势抄底。",plan:"1. 继续专注趋势跟踪和技术+基本面策略\n2. 减少M30以下时间框架的交易\n3. 目标：下周净盈利>$500"},
]

const monthlyNotes = [
  {month:"2026-01",lesson:"1月总体表现稳定，胜率62%，盈亏比1.8:1。趋势跟踪策略贡献了大部分利润。\n\n最大教训：在非农数据公布前持仓过重，导致一次大幅回撤。以后重大数据前必须减仓或平仓。",plan:"1. 重大经济数据前24小时减仓至半仓以下\n2. 增加技术+基本面共振策略的使用频率\n3. 月度净盈利目标：$2000\n4. A级执行率目标：>50%"},
  {month:"2026-02",lesson:"2月前三周表现优秀，胜率提升至73%。通道突破和趋势跟踪策略表现最佳。\n\n报复性交易仍是最大弱点（GBP/JPY），需要更强的纪律约束。黄金和原油的交易质量最高。",plan:"1. 严格执行连亏2笔后休息4小时的规则\n2. 重点研究黄金和原油的基本面驱动因素\n3. 减少低时间框架（M30以下）的交易\n4. 月度净盈利目标：$2500"},
]

async function seed() {
  for (const t of [...closedTrades, ...openTrades]) {
    const res = await fetch(`${BASE}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t)
    })
    const data = await res.json()
    console.log(`Trade [${t.status}]: ${t.date} ${t.pair} ${t.direction} -> ${res.status}`)
  }
  for (const n of notes) {
    const res = await fetch(`${BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n)
    })
    console.log(`Note: ${n.week} -> ${res.status}`)
  }
  for (const mn of monthlyNotes) {
    const res = await fetch(`${BASE}/monthly-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mn)
    })
    console.log(`Monthly Note: ${mn.month} -> ${res.status}`)
  }
  // Verify
  const check = await fetch(`${BASE}/trades`).then(r => r.json())
  const open = check.filter(t => t.status === 'open')
  const closed = check.filter(t => t.status === 'closed')
  console.log(`\nVerified: ${check.length} trades (${open.length} open, ${closed.length} closed)`)
}

seed().catch(console.error)
