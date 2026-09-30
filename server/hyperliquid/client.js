const INFO_URL = 'https://api.hyperliquid.xyz/info'
const ADDRESS = /^0x[a-fA-F0-9]{40}$/

export function normalizeAddress(value) {
  if (typeof value !== 'string' || !ADDRESS.test(value.trim())) throw new Error('请输入有效的 Hyperliquid 账户地址')
  return value.trim().toLowerCase()
}

async function requestInfo(body) {
  let response
  try {
    response = await fetch(INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    })
  } catch (error) {
    if ((process.env.HTTPS_PROXY || process.env.https_proxy) && error.message === 'fetch failed') {
      throw new Error('Hyperliquid 连接失败：当前 Node 未通过本机代理访问外网。Node 24.5+ 可设置 NODE_USE_ENV_PROXY=1 后重启服务')
    }
    throw new Error(`Hyperliquid 连接失败：${error.message}`)
  }
  if (!response.ok) throw new Error(`Hyperliquid 接口返回 ${response.status}`)
  try { return await response.json() }
  catch { throw new Error('Hyperliquid 返回了无效数据') }
}

export async function getPerpState(address) {
  const state = await requestInfo({ type: 'clearinghouseState', user: normalizeAddress(address) })
  if (!state || !Array.isArray(state.assetPositions) || !Number.isSafeInteger(state.time)) {
    throw new Error('Hyperliquid 持仓数据格式不正确')
  }
  for (const item of state.assetPositions) {
    const position = item?.position
    if (!position || typeof position.coin !== 'string' ||
        !Number.isFinite(Number(position.szi)) || !Number.isFinite(Number(position.entryPx))) {
      throw new Error('Hyperliquid 持仓字段不完整')
    }
  }
  return state
}

export async function getFillsByTime(address, startTime, endTime) {
  const fills = await requestInfo({
    type: 'userFillsByTime', user: normalizeAddress(address), startTime, endTime,
  })
  if (!Array.isArray(fills)) throw new Error('Hyperliquid 成交数据格式不正确')
  return fills
}
