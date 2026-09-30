import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePerpFill, reconcileFill } from './reconcile.js'

const rawFill = (startPosition, side, sz) => ({
  coin: 'BTC', startPosition: String(startPosition), side, sz: String(sz),
  px: '80000', closedPnl: '0', fee: '0.12', feeToken: 'USDC',
  time: 1_700_000_000_000, tid: `${startPosition}/${side}/${sz}`,
})
const fill = (startPosition, side, sz) => parsePerpFill(rawFill(startPosition, side, sz))

test('永续成交可识别开仓、加仓、部分平仓、完全平仓和反手', () => {
  const cases = [
    [0, 'B', 2, { kind: 'open', after: 2, closeSize: 0, openSize: 2 }],
    [2, 'B', 1, { kind: 'increase', after: 3, closeSize: 0, openSize: 1 }],
    [3, 'A', 1, { kind: 'reduce', after: 2, closeSize: 1, openSize: 0 }],
    [2, 'A', 2, { kind: 'close', after: 0, closeSize: 2, openSize: 0 }],
    [2, 'A', 3, { kind: 'reverse', after: -1, closeSize: 2, openSize: 1 }],
  ]
  for (const [start, side, size, expected] of cases) {
    assert.deepEqual(reconcileFill(start, fill(start, side, size)), expected)
  }
})

test('成交前仓位不一致时停止归并', () => {
  assert.throws(() => reconcileFill(1, fill(2, 'A', 1)), /仓位与成交不一致/)
})

test('拒绝缺少美元手续费口径的成交，忽略非默认永续品种', () => {
  assert.throws(() => parsePerpFill({ ...rawFill(0, 'B', 1), feeToken: 'BTC' }), /成交字段不完整/)
  assert.equal(parsePerpFill({ ...rawFill(0, 'B', 1), coin: '@1' }), null)
})
