# TradingView 实时图表 Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a TradingView Advanced Chart Widget above the open positions section in the record tab, desktop only.

**Architecture:** Single new component `TradingViewChart.jsx` that injects the TradingView widget script into a container div via `useEffect`/`useRef`. Imported and placed in `App.jsx` between `PsychologyPanel` and `OpenPositions` for desktop, hidden on mobile.

**Tech Stack:** React 19, TradingView Advanced Chart Widget (CDN script, no npm dependency)

---

### Task 1: Create TradingViewChart component

**Files:**
- Create: `client/src/components/TradingViewChart.jsx`

- [ ] **Step 1: Create the component file**

```jsx
import { useEffect, useRef, memo } from 'react'

function TradingViewChart() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: 'FX:EURUSD',
      theme: 'dark',
      autosize: true,
      style: '1',
      locale: 'zh_CN',
      allow_symbol_change: true,
      hide_side_toolbar: false,
      calendar: false,
      support_host: 'https://www.tradingview.com'
    })
    container.appendChild(script)

    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
    }
  }, [])

  return (
    <div className="hidden md:block mb-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ height: 400 }}>
        <div ref={containerRef} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }}>
          <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  )
}

export default memo(TradingViewChart)
```

- [ ] **Step 2: Verify file created**

Run: `ls -la client/src/components/TradingViewChart.jsx`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add client/src/components/TradingViewChart.jsx
git commit -m "feat: add TradingViewChart component with Advanced Chart Widget embed"
```

---

### Task 2: Integrate into App.jsx (desktop record tab only)

**Files:**
- Modify: `client/src/App.jsx`
  - Add import at line 11 (after `OpenPositions` import)
  - Insert `<TradingViewChart />` at line 430 (after `PsychologyPanel`, before `OpenPositions`) in desktop record tab
  - Mobile record tab (line 361-374) is NOT modified — component self-hides via `hidden md:block`

- [ ] **Step 1: Add import**

Add after the existing `OpenPositions` import (line 10):

```jsx
import TradingViewChart from './components/TradingViewChart'
```

- [ ] **Step 2: Insert component in desktop record tab**

In the desktop record tab content (inside `{tab === "record" && (` block), insert `<TradingViewChart />` between the `<PsychologyPanel ... />` block and `<OpenPositions .../>`:

```jsx
            <PsychologyPanel
              trades={allTrades}
              pairs={pairNames}
              spreadCostMap={spreadCostMap}
              onAddMissed={handleAddMissed}
              onDeleteTrade={confirmDeleteTrade}
            />
            <TradingViewChart />
            <OpenPositions openTrades={openTrades} onClose={handleCloseTrade} onDelete={confirmDeleteTrade} />
```

No changes needed for the mobile `mobileTabContent` section — the component renders `hidden md:block` so it self-hides on mobile. However, to avoid loading the iframe at all on mobile, do NOT add `<TradingViewChart />` inside the `mobileTabContent` switch block (lines 361-374).

- [ ] **Step 3: Verify dev server runs without errors**

Run: `cd client && npx vite build --mode development 2>&1 | tail -5`
Expected: build succeeds with no errors

- [ ] **Step 4: Manual verification**

Open `http://localhost:3000` in a desktop browser:
1. Navigate to the 交易记录 tab
2. Confirm TradingView chart appears above the open positions section
3. Confirm chart has dark theme matching the app
4. Confirm you can switch symbols inside the widget
5. Resize browser below `md` breakpoint (768px) — chart should disappear
6. Check browser console for errors — should be clean

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: integrate TradingView chart widget into record tab (desktop)"
```
