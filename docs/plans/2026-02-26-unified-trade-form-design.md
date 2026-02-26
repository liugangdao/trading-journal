# Unified Trade Form Design

**Date**: 2026-02-26
**Goal**: Merge open/close trade forms into a single unified form that defaults to recording complete trades, with a toggle for open-only entries.

## Current State

The trade form has 3 modes:
- **open**: Entry fields only → saves as `status: "open"`
- **close**: Exit fields only (with read-only entry summary) → saves as `status: "closed"`
- **edit**: All fields → saves existing trade

Users must open a trade first, then close it separately — too cumbersome for the common case of recording a completed trade.

## Design

### Default: Record Complete Trade (toggle off)

- Show all fields: date, pair, direction, strategy, timeframe, lots, entry\*, stop\*, target, exit\_price\*, gross\_pnl\*, swap, score, emotion, notes
- Required: entry, stop, exit\_price, gross\_pnl
- Submit button: "记录交易"
- Saves as `status: "closed"`

### Toggle On: Open Only

- Bottom of form: "仅开仓（稍后平仓）" toggle switch
- When on: hide exit fields (exit\_price, gross\_pnl, swap, score)
- Required: entry, stop
- Submit button changes to: "记录开仓"
- Saves as `status: "open"`

### Close Mode (unchanged)

- Triggered from OpenPositions card "平仓" button
- Shows read-only entry summary + exit fields only
- Behavior unchanged

### Edit Mode (unchanged)

- Triggered from trade table edit button
- Shows all fields, behavior unchanged

## Files to Change

1. **TradeForm.jsx**: Add toggle state, adjust field visibility and required fields based on toggle
2. **App.jsx**: Default formMode → "edit" (full fields), rename "+ 开仓" button to "+ 记录交易"
3. **emptyTrade()**: Change default status from "open" to "closed"
