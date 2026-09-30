export const EXIT_REASONS = ['结构止损', '移动止损', 'measured move目标', '手动平仓']
export const EXECUTION_TAGS = ['计划内', 'FOMO', '追涨杀跌', '提前平仓', '移动止损过早', '逆势', '未等收盘确认']

export function getExecutionTags(trade) {
  try {
    const tags = JSON.parse(trade.execution_tags || '[]')
    return Array.isArray(tags) ? tags.filter(tag => EXECUTION_TAGS.includes(tag)) : []
  } catch {
    return []
  }
}
