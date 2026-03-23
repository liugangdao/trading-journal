const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

// Throttle: batch if >3 closes within 5 minutes
const recentCloses = []
const THROTTLE_WINDOW = 5 * 60 * 1000  // 5 minutes
const THROTTLE_LIMIT = 3
let batchTimeout = null

async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    })
  } catch (err) {
    console.error('Telegram webhook failed:', err.message)
  }
}

export function notifyTradeClose(trade) {
  const now = Date.now()
  // Prune old entries
  while (recentCloses.length && recentCloses[0].ts < now - THROTTLE_WINDOW) {
    recentCloses.shift()
  }
  recentCloses.push({ ts: now, trade })

  if (recentCloses.length <= THROTTLE_LIMIT) {
    // Under limit: send immediately
    const text = `/closed ${trade.id} ${trade.pair} ${trade.direction} ${trade.gross_pnl}`
    sendTelegram(text)
  } else if (!batchTimeout) {
    // Over limit: batch remaining, send after 1 minute
    batchTimeout = setTimeout(() => {
      const batch = recentCloses.map(r =>
        `${r.trade.pair} ${r.trade.direction} $${r.trade.gross_pnl}`
      ).join('\n')
      sendTelegram(`/closed-batch\n${batch}`)
      recentCloses.length = 0
      batchTimeout = null
    }, 60 * 1000)
  }
  // else: batch timer already running, trade is queued in recentCloses
}
