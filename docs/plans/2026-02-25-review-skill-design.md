# /review Skill Design

## Overview

Claude Code skill that analyzes trading data and auto-generates weekly/monthly review notes.

## Trigger

- `/review weekly` — generate weekly review (周度复盘)
- `/review monthly` — generate monthly review (月度复盘)
- Optional time parameter: `/review weekly 2026-W08`, `/review monthly 2026-02`

## Flow

1. Parse args to determine type (weekly/monthly) and time range (default: current)
2. `curl GET /api/trades` → filter by date range
3. Analyze: win rate, P&L ratio, best/worst trades, emotion distribution, strategy performance, execution scores
4. Generate `lesson` + `plan` text in Chinese
5. Display to user for review
6. On confirmation → `curl POST /api/notes` or `/api/monthly-notes` to save

## Data Source

HTTP API at `localhost:3001`. Server must be running.

## Analysis Dimensions

- Win rate and total P&L
- Best and worst trades (with reasons)
- Strategy breakdown (which strategies worked)
- Emotion/execution score distribution
- Recurring patterns and mistakes
- Actionable improvement plan

## File

`.claude/skills/review.md` — single skill file, no helper scripts needed.
