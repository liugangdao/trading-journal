# PWA Mobile Native App Feel — Design Spec

> Only affects mobile viewport (`<640px`). Desktop remains unchanged.

**Goal:** Transform the mobile PWA experience from "website in a browser" to "native iOS app feel" with bottom navigation, smooth transitions, touch feedback, and safe area support.

## 1. Layout Architecture

### Mobile (`<640px`)

**Top bar:** Simple title bar with app name centered. No tabs, no nav. Just "交易日志" title.

**Bottom tab bar:** Fixed at screen bottom, 4 tabs + center action button:

```
📊 记录  |  📈 统计  |  [+]  |  📝 笔记  |  ⚙️ 更多
```

- Center "+" button: Raised/prominent, accent blue, circular, triggers trade creation sheet
- Active tab: accent color icon + label
- Inactive tab: muted color
- Tab bar background: `bg-card` with top border
- Icons: Inline SVGs (consistent with existing `ThemeToggle` pattern), not emoji
- Bottom padding accounts for iOS Home Indicator via `env(safe-area-inset-bottom)`

**Tab mapping:**

| Bottom Tab | Maps to existing tab(s) | Content |
|-----------|------------------------|---------|
| 记录 | `record` | Open positions + closed trade list. No inline form, no "记录交易" button. ExportBar hidden on mobile (moved to 更多). |
| 统计 | `stats` | Dashboard (unchanged) |
| [+] | N/A (action) | Opens full-screen trade form sheet |
| 笔记 | `weekly` + `monthly` | Combined view with internal week/month toggle |
| 更多 | `policy` + `settings` | Combined screen with inline sections |

### Desktop (`>=640px`)

Completely unchanged. Same header with horizontal tabs, same layout. The mobile components only render below 640px breakpoint.

## 2. Full-Screen Trade Form Sheet

### Opening the sheet

The sheet opens in three scenarios:
1. **New trade:** User taps center "+" button → sheet opens in "new" mode with empty form
2. **Close trade:** User taps "平仓" on an open position in the record tab → sheet opens in "close" mode, pre-filled with open trade data
3. **Edit trade:** User taps a closed trade row in the record tab → sheet opens in "edit" mode, pre-filled with trade data

On mobile, `handleEditTrade` and `handleCloseTrade` open the sheet **without switching tabs** (unlike desktop which switches to the record tab).

### Sheet behavior

- **Animation:** Slides up from bottom, 300ms with iOS spring curve `cubic-bezier(0.32, 0.72, 0, 1)`
- **Dismiss:** Slide down 250ms; triggered by "取消" button
- **Header:** Sticky top bar within scrollable sheet with "取消" (left), title (center), "提交" (right, green)
  - Title varies by mode: "记录交易" (new), "平仓记录" (close), "编辑交易" (edit)
- **Content:** Scrollable form area containing:
  1. LivermoreQuote (existing component, not shown in edit mode)
  2. iOS-style grouped form fields (rounded card sections with internal dividers)
  3. Discipline confirmation checklist
- **Backdrop:** Dark overlay behind sheet, `bg-black/50`
- **Scroll lock:** Body scroll disabled when sheet is open (`overflow: hidden` on body)

### State management

The existing `App.jsx` state (`showForm`, `editing`, `closingId`, `formMode`, `formInitial`) drives the sheet. `MobileLayout` receives these as props:

```
App.jsx → MobileLayout
  showForm        → controls sheet visibility
  formMode        → "new" | "close" | "edit"
  formInitial     → initial form data
  onNewTrade()    → sets showForm=true, clears editing/closingId
  onSubmit()      → handleAddTrade or handleCloseSubmit
  onCancel()      → handleCancelForm
  + all TradeForm props (pairs, policies, etc.)
```

No new state is introduced. The sheet is purely a presentational wrapper around the existing form state.

## 3. Combined Notes Tab (笔记)

Merges weekly and monthly notes into a single tab:

- **Top toggle:** Two-segment control ("周度复盘" / "月度复盘") at top of content area
- **Content:** Renders existing `WeeklyNotes` or `MonthlyNotes` component based on toggle
- **State:** Toggle state is local to `NotesTab`, defaults to "周度复盘"
- **Desktop:** No change — weekly and monthly remain separate tabs in the header

## 4. "More" Tab (更多)

Combines Policy, Settings, Export, and user actions into one screen with inline sections (no sub-navigation):

- **Layout:** iOS-style grouped sections, rendered inline on a scrollable page
- **Sections:**
  - **交易政策** — Renders existing `Policies` component inline (it manages its own data fetching)
  - **品种设置** — Renders existing `Settings` component inline (receives `pairs`, `onPairsChange` props)
  - **导出/导入** — Renders existing `ExportBar` component
  - **主题切换** — Dark/light toggle row
  - **用户信息** — Username display + logout button
- Each section has a header label and is separated by spacing. Sections are always visible (no collapse/expand).

## 5. Touch & Interaction

### Touch feedback
- All tappable elements: `active:scale-[0.97]` + `active:opacity-80` with `transition-transform duration-100`
- Cards/list items: slight background darkening on press
- Minimum touch target: 44px height for all interactive elements

### Transitions
- **Tab switching:** Content cross-fade, 150ms
- **Form sheet:** Slide up from bottom 300ms, dismiss slide down 250ms
- **No horizontal swipe** between tabs (keeps implementation simple)

### Haptic feedback
- `navigator.vibrate(10)` on tab switch (where supported, silent fail on iOS)

## 6. Safe Areas

### Viewport
Update `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

### CSS
- Top bar: `padding-top: env(safe-area-inset-top)`
- Bottom tab bar: `padding-bottom: env(safe-area-inset-bottom)`
- Form sheet: respects both top and bottom safe areas

## 7. Edge Cases

- **PwaPrompt overlay:** Reposition above bottom tab bar on mobile (currently fixed bottom-4, needs to account for tab bar height)
- **Loading state:** Mobile uses same "加载中..." full-screen spinner as desktop
- **Empty states:** Notes tab empty states come from existing WeeklyNotes/MonthlyNotes components unchanged
- **Keyboard handling:** Sheet header uses `position: sticky` (not fixed) within a scrollable container to avoid iOS keyboard push issues

## 8. Implementation Strategy

### New components
- `MobileLayout.jsx` — Bottom tab bar + mobile top bar + sheet container (only renders `<640px`)
- `MobileSheet.jsx` — Full-screen slide-up sheet with animation and scroll lock
- `NotesTab.jsx` — Combined weekly/monthly notes with segment toggle
- `MoreTab.jsx` — Combined policy/settings/export/user info, all inline

### Modified components
- `Layout.jsx` — Detect mobile via CSS classes, render `MobileLayout` or current desktop layout
- `App.jsx` — Pass sheet-related props to Layout; form state logic unchanged
- `TradeForm.jsx` — Add mobile-specific CSS classes for iOS grouped list style (conditional on viewport)
- `index.html` — Add `viewport-fit=cover`
- `index.css` — Add sheet animation keyframes, safe area utilities

### Breakpoint strategy
- Use Tailwind's `sm:` prefix (640px) as the boundary
- Mobile-specific components use `block sm:hidden`
- Desktop components use `hidden sm:block`
- Shared logic stays in `App.jsx`

### What does NOT change
- All backend/API code
- Desktop layout and behavior
- Trade CRUD logic in App.jsx
- TradeForm business logic (validation, submission)
- Dashboard, OpenPositions components
- Auth flow
