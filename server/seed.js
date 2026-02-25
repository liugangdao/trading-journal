// Seed script - run with: node seed.js
// Must run from project root after server has been started at least once (to create DB)

import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, 'data')
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

const db = new Database(join(dataDir, 'journal.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, pair TEXT NOT NULL, direction TEXT NOT NULL,
    strategy TEXT NOT NULL, timeframe TEXT NOT NULL, lots REAL,
    entry REAL NOT NULL, stop REAL NOT NULL, target REAL,
    exit_price REAL, gross_pnl REAL,
    swap REAL DEFAULT 0, score TEXT, emotion TEXT, notes TEXT,
    status TEXT NOT NULL DEFAULT 'closed',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS weekly_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week TEXT NOT NULL, lesson TEXT, plan TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS monthly_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL, lesson TEXT, plan TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

// Clear existing data
db.exec('DELETE FROM trades; DELETE FROM weekly_notes; DELETE FROM monthly_notes;')

const insertTrade = db.prepare(`
  INSERT INTO trades (date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// Closed trades (status = 'closed')
const closedTrades = [
  ["2026-02-10","EUR/USD","多(Buy)","趋势跟踪","H4",0.5,1.0325,1.0295,1.04,1.0372,235,-2.5,"A-完美执行","冷静理性","趋势明确，回调至支撑位入场，严格执行计划","closed"],
  ["2026-02-11","GBP/USD","空(Sell)","通道突破","H1",0.3,1.265,1.269,1.258,1.2595,165,1.2,"B-基本执行","冷静理性","通道上轨做空，目标未完全到达提前止盈","closed"],
  ["2026-02-12","XAU/USD","多(Buy)","回调入场","H4",0.2,2025.5,2018,2045,2042.3,336,-5.8,"A-完美执行","略有紧张","金价回调至前期支撑2025附近入场，持仓过程略有紧张但坚持持有","closed"],
  ["2026-02-13","USD/JPY","多(Buy)","形态交易","M30",0.4,149.85,149.55,150.3,149.62,-92,0,"C-有偏差","恐惧犹豫","双底形态入场，但未等确认就急于进场，止损出局","closed"],
  ["2026-02-14","AUD/USD","空(Sell)","技术+基本面","D1",0.3,0.635,0.6385,0.628,0.6288,186,3.5,"B-基本执行","冷静理性","澳联储偏鸽叠加技术面破位，基本面与技术面共振做空","closed"],
  ["2026-02-17","EUR/GBP","多(Buy)","均值回归","H4",0.2,0.832,0.8295,0.836,0.8355,70,-1,"B-基本执行","冷静理性","价格偏离均线过远，均值回归做多","closed"],
  ["2026-02-18","GBP/JPY","多(Buy)","趋势跟踪","H1",0.2,188.5,187.8,189.8,187.9,-120,0,"D-严重违规","报复心态","前一笔亏损后急于回本，没有等到好的入场点就冲进去了","closed"],
  ["2026-02-19","XAU/USD","空(Sell)","通道突破","H4",0.15,2058,2065,2038,2040.5,262.5,-3.2,"A-完美执行","冷静理性","黄金触及通道上轨后反转做空，完美执行止盈","closed"],
  ["2026-02-20","USD/CAD","多(Buy)","基本面驱动","D1",0.4,1.358,1.354,1.365,1.3642,248,2,"B-基本执行","略有紧张","加拿大就业数据不及预期，美加做多，持仓2天","closed"],
  ["2026-02-21","EUR/USD","空(Sell)","趋势跟踪","H4",0.5,1.041,1.0445,1.035,1.0365,225,-1.8,"B-基本执行","冷静理性","欧元下行趋势延续，反弹做空","closed"],
  ["2026-02-24","NZD/USD","多(Buy)","回调入场","H1",0.3,0.572,0.5695,0.577,0.5685,-105,0,"C-有偏差","贪婪冲动","看到快速下跌想抄底，没有等到信号确认就入场","closed"],
  ["2026-02-25","USOil","多(Buy)","技术+基本面","H4",0.2,72.5,71.8,74,73.65,230,-4,"A-完美执行","冷静理性","EIA库存大减叠加技术面突破，原油做多","closed"],
]

// Open trades (status = 'open') - no exit_price/gross_pnl
const openTrades = [
  ["2026-02-25","GBP/USD","多(Buy)","趋势跟踪","H4",0.3,1.267,1.263,1.275,null,null,0,null,"冷静理性","英镑回调至4H支撑位，趋势延续做多","open"],
  ["2026-02-25","XAU/USD","空(Sell)","通道突破","H1",0.15,2045,2052,2030,null,null,0,null,"略有紧张","金价触及通道上轨，等待反转信号后做空","open"],
  ["2026-02-25","USD/JPY","多(Buy)","技术+基本面","H4",0.2,150.2,149.7,151.5,null,null,0,null,"冷静理性","美日利差扩大叠加技术面突破，做多","open"],
]

const insertMany = db.transaction((rows) => {
  for (const row of rows) insertTrade.run(...row)
})
insertMany([...closedTrades, ...openTrades])

const insertNote = db.prepare('INSERT INTO weekly_notes (week, lesson, plan) VALUES (?, ?, ?)')

insertNote.run(
  "2026-W07",
  "报复性交易是最大敌人。GBP/JPY那笔亏损完全是因为前一笔止损后情绪失控。\n\n规则：连续亏损2笔后强制休息4小时。",
  "1. 严格执行4小时冷静期规则\n2. 每笔交易前写下入场理由\n3. 重点关注A级执行率，目标>60%"
)

insertNote.run(
  "2026-W08",
  "本周胜率提升到75%，主要得益于只做高确认度信号。黄金和原油的基本面+技术面共振策略表现最好。\n\n抄底NZD/USD的教训：不要在下跌趋势中逆势抄底。",
  "1. 继续专注趋势跟踪和技术+基本面策略\n2. 减少M30以下时间框架的交易\n3. 目标：下周净盈利>$500"
)

const insertMonthlyNote = db.prepare('INSERT INTO monthly_notes (month, lesson, plan) VALUES (?, ?, ?)')

insertMonthlyNote.run(
  "2026-01",
  "1月总体表现稳定，胜率62%，盈亏比1.8:1。趋势跟踪策略贡献了大部分利润。\n\n最大教训：在非农数据公布前持仓过重，导致一次大幅回撤。以后重大数据前必须减仓或平仓。",
  "1. 重大经济数据前24小时减仓至半仓以下\n2. 增加技术+基本面共振策略的使用频率\n3. 月度净盈利目标：$2000\n4. A级执行率目标：>50%"
)

insertMonthlyNote.run(
  "2026-02",
  "2月前三周表现优秀，胜率提升至73%。通道突破和趋势跟踪策略表现最佳。\n\n报复性交易仍是最大弱点（GBP/JPY），需要更强的纪律约束。黄金和原油的交易质量最高。",
  "1. 严格执行连亏2笔后休息4小时的规则\n2. 重点研究黄金和原油的基本面驱动因素\n3. 减少低时间框架（M30以下）的交易\n4. 月度净盈利目标：$2500"
)

console.log(`Seeded ${closedTrades.length} closed trades, ${openTrades.length} open trades, 2 weekly notes, and 2 monthly notes.`)
db.close()
