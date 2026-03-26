# UI Polish Design — 流畅感与视觉升级

## 概述

对交易日志应用进行全面 UI 打磨，覆盖桌面端和移动端。按层次逐步叠加：基础设施 → 反馈层 → 动效层 → 加载层 → 内容层。

## 第一阶段：基础设施

### 1.1 Toast 通知组件

**组件**：`Toast.jsx` + `ToastProvider` + `useToast()` hook

- 位置：屏幕顶部居中，从上往下滑入
- 类型：`success`（绿色）、`error`（红色）、`info`（accent 蓝）
- 自动消失：3 秒后淡出
- 堆叠：多条 toast 纵向堆叠，最新在上
- 实现：React Context，App 顶层挂载 `<ToastProvider>`，各组件通过 `useToast()` 调用

**API**：
```js
const toast = useToast()
toast.success('交易已记录')
toast.error('操作失败，请重试')
toast.info('已复制到剪贴板')
```

### 1.2 确认弹窗组件（ConfirmDialog）

- 用于所有破坏性操作（删除交易、删除笔记等）
- 居中模态框 + 半透明遮罩
- 按钮：取消（灰色）+ 确认（红色）
- 动画：scale(0.95→1) + fade 进入，fade 退出

**API**：
```jsx
<ConfirmDialog
  open={showConfirm}
  title="确认删除"
  message="删除后无法恢复"
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
/>
```

### 1.3 图标库引入

- 安装 `lucide-react`
- tree-shakable，按需 import
- 统一参数：tab 栏 `size={22} strokeWidth={1.8}`，按钮 `size={16-18}`

### 1.4 CSS 动画工具类

在 `index.css` 中添加通用动画类：

```css
/* Stagger fade-in for list items */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fade-in-up 200ms ease-out both;
}

/* Shimmer for skeleton */
@keyframes shimmer {
  /* 复用已有 landing page shimmer */
}

/* Tab content transition */
.tab-enter {
  animation: fade-in-up 150ms ease-out both;
}
```

## 第二阶段：反馈层

### 2.1 CRUD 操作接入 Toast

所有操作成功/失败后触发 toast：

| 操作 | 成功提示 | 失败提示 |
|------|----------|----------|
| 开仓 | "交易已记录" | "记录失败，请重试" |
| 平仓 | "已平仓" | "平仓失败，请重试" |
| 编辑交易 | "已更新" | "更新失败，请重试" |
| 删除交易 | "已删除" | "删除失败，请重试" |
| 导入数据 | "导入成功，共 N 条" | "导入失败" |
| 添加笔记 | "笔记已保存" | "保存失败" |
| 删除笔记 | "已删除" | "删除失败" |

### 2.2 删除操作接入确认弹窗

所有 delete handler（`handleDeleteTrade`、`handleDeleteNote`、`handleDeleteMonthlyNote`）改为先弹 ConfirmDialog，确认后再执行删除 + toast。

### 2.3 表单提交 Loading 状态

- 提交按钮点击后：显示 spinner + 文字变 "提交中..."，按钮 `disabled`
- 完成后恢复，sheet 关闭 + toast 提示

## 第三阶段：动效层

### 3.1 Tab 切换过渡

- 桌面端和移动端 tab 内容切换时加 `.tab-enter` 类（fade + slide-up，150ms）
- 移动端增强现有 `mobile-tab-enter` 为 fade + translateY(8px→0)

### 3.2 列表入场 Stagger 动画

- 交易卡片、KPI 卡片、持仓卡片首次渲染时 stagger fade-in-up
- 每张卡片通过 `style={{ animationDelay: '${index * 40}ms' }}` 设置延迟
- 使用 `.animate-fade-in-up` 类
- 仅首次渲染触发（`animation-fill-mode: both`）

### 3.3 KPI 数字滚动动画

- 新建 `useCountUp(target, duration=600)` hook
- 使用 `requestAnimationFrame` + easeOut 缓动
- 返回当前显示值，从 0 滚动到目标值
- 适用于 KpiCard 的金额、百分比、次数

### 3.4 卡片微交互增强

- 桌面端 hover：`translateY(-2px)` + `shadow` 加深，`transition 300ms`
- 移动端保留现有 `active:scale-[0.97]`

### 3.5 表单提交按钮反馈

- 提交完成后按钮短暂变绿 + checkmark（300ms），然后恢复/关闭

## 第四阶段：加载层

### 4.1 Skeleton 骨架屏组件

**组件**：`Skeleton.jsx`

- 形状：通过 className 控制宽高和圆角
- 样式：`bg-border` 底色 + shimmer 扫光动画
- 预设组合：`SkeletonCard`（卡片骨架）、`SkeletonKpi`（KPI 骨架）

### 4.2 使用场景

- **首次加载**（`loading` 状态时）：Record 页显示 3 张 SkeletonCard + KPI 骨架区域，替代 "加载中..." 文字
- **Dashboard 页**：图表区域显示矩形骨架
- 切换 tab 时如果数据已有则直接渲染，不显示骨架

### 4.3 骨架到真实内容过渡

- 骨架淡出（200ms）→ 真实卡片 stagger 淡入
- 自然衔接，无硬切

## 第五阶段：内容层

### 5.1 空状态插图

内联 SVG 插画，细线条 + accent 色点缀，高度约 120px，居中 + 下方配文字。

| 场景 | 图形 | 文字 |
|------|------|------|
| 无交易记录 | 空文档/图表 | "暂无交易记录" |
| 无持仓 | 平静趋势线 | "当前无持仓" |
| 无笔记 | 笔 + 空白纸 | "还没有复盘笔记" |
| Dashboard 无数据 | 空图表框 | "开始交易后这里会显示统计" |

静态展示，不加动画。

### 5.2 图标全面替换

用 Lucide React 替换所有手写内联 SVG：

| 位置 | 当前 | 替换为 |
|------|------|--------|
| MobileLayout tab 栏 | 手写 SVG ×4 | `FileText`, `BarChart3`, `PenLine`, `Settings` |
| MobileLayout + 按钮 | 手写 + 号 | `Plus` |
| TradeTable 排序 | 手写箭头 | `ArrowUpDown`, `ChevronDown` |
| OpenPositions 操作 | 手写按钮 | `X`, `Trash2` |
| 主题切换 | 手写 sun/moon | `Sun`, `Moon` |
| 其他零散图标 | 手写 | 对应 Lucide 图标 |

统一参数：`strokeWidth={1.8}`，尺寸按场景定。

## 不做的事

- 不引入 Framer Motion 等重量级动画库，纯 CSS + 轻量 hook
- 不做页面间路由动画（app 是单页 tab 切换）
- 不做复杂的空状态动画
- 不改现有布局结构和配色方案
- 不加音效或复杂触觉反馈

## 影响范围

### 新增文件
- `client/src/components/ui/Toast.jsx` — Toast 组件 + Provider + hook
- `client/src/components/ui/ConfirmDialog.jsx` — 确认弹窗
- `client/src/components/ui/Skeleton.jsx` — 骨架屏
- `client/src/components/EmptyState.jsx` — 空状态插图
- `client/src/hooks/useCountUp.js` — 数字滚动 hook

### 修改文件
- `client/src/index.css` — 新增动画工具类
- `client/src/App.jsx` — 挂载 ToastProvider，CRUD handler 接入 toast + confirm
- `client/src/components/Layout.jsx` — 桌面端 tab 过渡
- `client/src/components/MobileLayout.jsx` — 图标替换，tab 过渡增强
- `client/src/components/MobileSheet.jsx` — 提交 loading 状态
- `client/src/components/TradeForm.jsx` — 提交按钮 loading/success 状态
- `client/src/components/TradeTable.jsx` — stagger 动画，图标替换，空状态
- `client/src/components/OpenPositions.jsx` — stagger 动画，图标替换，空状态
- `client/src/components/ui/KpiCard.jsx` — 数字滚动动画，hover 增强
- `client/src/components/Dashboard.jsx` — 骨架屏，空状态
- `client/src/components/NotesTab.jsx`（或等价组件）— 空状态
- `package.json` — 添加 `lucide-react` 依赖
