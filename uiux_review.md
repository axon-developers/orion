# ORION — UI/UX Review & Improvement Roadmap

> Reviewed on: 2026-07-11 | Scope: orion-frontend (React 18 + TypeScript + Tailwind CSS)

---

## ✅ What's Working Well

Before diving into gaps, here's what's already solid:

- **Design System**: Consistent use of CSS variables (`--primary`, `--border`, etc.) with well-defined dark/light themes.
- **Glassmorphism**: The `.glass` and `.glass-panel` utilities create a premium feel without over-use.
- **Micro-animations**: `animate-in`, `fade-in`, `hover:scale-[1.02]` add life to the cards without being distracting.
- **Loading States**: Skeleton loaders on the Dashboard are a great touch for perceived performance.
- **Inactivity Timeout**: 15-minute session expiry with toast notification is a professional security feature.
- **Command Palette**: Global keyboard shortcut system (`CommandPalette`) is enterprise-grade UX.
- **Scrollbar Styling**: Custom thin scrollbars are subtle and polished.

---

## 🔴 Critical Issues (Fix These First)

### 1. Dashboard — Fake Trend Data

**Location**: [`DashboardPage.tsx`](file:///d:/Projects/orion/orion-frontend/src/pages/dashboard/DashboardPage.tsx) — Lines 42–60

The `trendData` is seeded with `Math.random()` on every render, which means the chart shows **false data**. This will confuse users and erode trust in the platform.

```typescript
// ❌ CURRENT — generates fake randomized trend data on the fly
Passed: Math.max(0, (stats.passedExecutions || 5) - Math.floor(Math.random() * 5)),
```

**Fix**: Add a dedicated `/dashboard/execution-trend?days=7` API endpoint on the backend that returns actual day-by-day aggregates.

---

### 2. Execution List — Missing Pagination

**Location**: [`ExecutionListPage.tsx`](file:///d:/Projects/orion/orion-frontend/src/pages/executions/ExecutionListPage.tsx) — Line 18

```typescript
// ❌ CURRENT — hard-coded 100-item limit, no pagination UI
const url = `/executions?page=0&size=100`;
```

As executions grow, this will cause slow loads, memory bloat, and an infinite scrolling table with no navigation. **Add a proper paginated table** with Previous/Next controls and a page size selector.

---

### 3. Execution List — No Search Bar

The executions list only has a `<select>` status filter, but no text search. Users cannot find a specific test case run by name. **Add a search/filter input** at the top of the table.

---

### 4. Breadcrumbs — Raw UUID Segments

**Location**: [`Header.tsx`](file:///d:/Projects/orion/orion-frontend/src/components/layout/Header.tsx) — Lines 59–75

When on a URL like `/applications/a1b2c3d4-xxxx/testcases/xxxx-xxxx/designer`, the breadcrumb shows the raw UUID. Users have no idea which app or test case they are in.

**Fix**: Resolve segment names from the store or a shared query cache (e.g., show `Applications / My App / Designer` instead of `Applications / a1b2c3d4... / testcases / ...`).

---

## 🟠 High-Priority Improvements

### 5. Dashboard — Add "Quick Actions" Panel

The welcome banner has a single "Build Test Cases" button. A **Quick Actions** panel with links to common tasks would dramatically improve first-session productivity:

```
[ ▶ Run Last Test ]  [ + New Test Case ]  [ ⚙ Open Global Config ]  [ 📊 View Executions ]
```

---

### 6. Dashboard — No Failure Rate Ring / Progress Indicator

The pass rate is shown as a bare number (`82.5%`). A **circular progress ring** or **progress bar** next to this stat would give it immediate visual meaning at a glance, especially for high-stakes QA environments.

---

### 7. Dashboard — Avg Duration Stat is Missing

Currently 4 stat cards are shown: Total, Passed, Failed, Pass Rate. An **Average Duration** (`avgDurationMs`) card would be invaluable for performance regression monitoring.

---

### 8. Sidebar — Collapsed Mode Loses Tooltips

**Location**: [`Sidebar.tsx`](file:///d:/Projects/orion/orion-frontend/src/components/layout/Sidebar.tsx) — Lines 80–83

When the sidebar is collapsed to icon-only mode, nav items have **no tooltip**. Users have to expand the sidebar to know what each icon means.

**Fix**: Add `title={item.label}` or a Radix `<Tooltip>` wrapper around each collapsed nav icon.

---

### 9. Sidebar — Admin Items Not Shown When Sidebar is Collapsed

**Location**: [`Sidebar.tsx`](file:///d:/Projects/orion/orion-frontend/src/components/layout/Sidebar.tsx) — Line 113

```typescript
{!collapsed && (
  <p className="... uppercase ...">Administration</p>
)}
```

The section label is hidden when collapsed, but admin icons still render. However, the conditional on the label creates a visual gap. The icons themselves also need tooltip labels in collapsed mode (same fix as above).

---

### 10. Login Page — Missing "Show Password" Toggle

**Location**: [`LoginPage.tsx`](file:///d:/Projects/orion/orion-frontend/src/pages/auth/LoginPage.tsx) — Lines 85–94

The password field has no visibility toggle. Add an eye/eye-off icon button (`Eye`/`EyeOff` from Lucide) inside the input to let users verify their typed password. This is a standard form UX requirement.

---

### 11. Login Page — No Loading Spinner on Button

```typescript
// ❌ CURRENT — plain text, no visual feedback
{loading ? 'Signing in...' : 'Sign In'}
```

Replace the text with a `<Loader2>` spinner + text during `loading` state to give clear visual feedback that the request is in-flight.

---

### 12. Workflow Designer — Context Menu is Sparse

**Location**: [`WorkflowCanvas.tsx`](file:///d:/Projects/orion/orion-frontend/src/components/workflow/WorkflowCanvas.tsx) — Lines 123–145

The right-click context menu only has **Duplicate** and **Delete**. Consider adding:
- **Enable / Disable** — toggles the step's `enabled` flag
- **Move to Top / Bottom** — quick reordering
- **Copy Step JSON** — for sharing step configs between test cases

---

### 13. Step Config Panel — No "Unsaved Changes" Guard on Navigation

If a user has unsaved changes in the Workflow Designer and clicks a nav item in the sidebar to leave, the changes are **silently lost**. Add a `beforeunload` guard or a confirmation dialog when `isDirty === true` and the user attempts to navigate away.

---

### 14. Execution Detail — Step Duration Chart Needs Axis Label

**Location**: [`ExecutionDetailPage.tsx`](file:///d:/Projects/orion/orion-frontend/src/pages/executions/ExecutionDetailPage.tsx) — Lines 113–120

The `TimelineChart` bar chart uses `sequenceOrder` as the X-axis label. This tells users almost nothing. **Use the step name (truncated)** instead, or add a combined tooltip that shows name + duration on hover.

---

## 🟡 Medium-Priority Improvements

### 15. Application Detail Page — Tab Navigation Loses State on Reload

Switching tabs (`overview`, `testcases`, `environments`, `executions`) resets to `overview` on browser refresh because the active tab is stored in local component state. **Sync the active tab to the URL query param** (`?tab=testcases`) so users can bookmark and share specific views.

---

### 16. Test Case Cards — No "Last Run" Status Indicator

On the test cases tab inside Application Detail, test case cards show name, priority, and tags, but **no status of the last execution**. A small colored dot (green/red/yellow) next to each test case name would let teams immediately see health at a glance.

---

### 17. Global Config Page — No Confirmation on Delete

Deleting an environment variable or database connection should have a **confirmation dialog** to prevent accidental data loss. Currently, deletion appears to be immediate with no undo option.

---

### 18. Profile Page — No Avatar Upload

**Location**: [`ProfilePage.tsx`](file:///d:/Projects/orion/orion-frontend/src/pages/settings/ProfilePage.tsx)

The profile page shows an initial-based avatar, but there's no way to upload a custom avatar image. Adding file upload support with a circular crop preview would make the user experience feel more personal.

---

### 19. Workflow Designer — Step Search / Jump

When a workflow has many steps (20+), there is no way to quickly locate a specific step without scrolling through the visual canvas. A **step search bar** at the top of the step list panel (left panel) that filters steps by name would greatly improve navigation.

---

### 20. Execution Detail — No "Download Report" as PDF/HTML

Users can download a JSON script via the browser automation config, but there's no way to export an execution report. A **"Download Report"** button that generates an HTML or PDF summary (step status, durations, assertions, timestamps) would be an immediate enterprise value-add.

---

### 21. Execution Detail — Log Timestamps are Absolute, Not Relative

Execution step log timestamps should show **both relative elapsed time** (e.g., `+1.2s`) and absolute time. Right now only the duration is shown. A relative elapsed timeline makes it very easy to identify which step caused the bottleneck.

---

### 22. Step Type Selector — No Category Filtering

**Location**: [`StepTypeSelector.tsx`](file:///d:/Projects/orion/orion-frontend/src/components/workflow/StepTypeSelector.tsx)

All step types are shown in a flat grid. As more step types are added (e.g., MAINFRAME_TERMINAL), the grid becomes harder to scan. Add **category tabs** (Primary, Support, Display, Technical, Integration) aligned with how README.md groups them.

---

### 23. Theme Toggle — No Transition Animation

Toggling between dark and light mode is an instant CSS class swap. Add a **smooth CSS color transition** (`transition: background-color 0.3s, color 0.3s`) across the root to make the theme switch feel polished rather than jarring.

```css
/* Suggested addition in index.css */
*, *::before, *::after {
  transition: background-color 0.25s ease, color 0.15s ease, border-color 0.2s ease;
}
```

---

## 🟢 Lower Priority / Feature Additions

### 24. 🆕 Notification/Alert Center

Add a bell icon to the Header with a notification dropdown that surfaces:
- Failed executions since last login
- Long-running or stuck RUNNING executions
- Global config changes made by other admins

This would make ORION feel like a proper monitoring platform.

---

### 25. 🆕 Test Case Tags — Clickable Filters on Overview

Tags are rendered as decorative badges on test cases. Make them **clickable** so clicking a tag filters the test case list to show only cases sharing that tag. This enables rapid grouping for smoke tests, regression suites, etc.

---

### 26. 🆕 Keyboard Shortcuts Reference Page

The Command Palette is a power-user feature. Add a **Keyboard Shortcuts** page or modal (accessible via `?` key or the Help menu) that lists all available shortcuts. Users won't use what they can't discover.

---

### 27. 🆕 Execution Comparison View

Allow users to **compare two execution runs side-by-side**: step names, durations, pass/fail status. This is invaluable for regression analysis (e.g., "Did step 4 get slower?").

---

### 28. 🆕 Inline Variable Preview in Config Panel

When a user types `{{variableName}}` in any config field (URL, body, SQL), show a **live preview tooltip** with the resolved variable value from the selected environment. This prevents run failures caused by undefined or misspelled variable references.

---

### 29. 🆕 Step Dependency Visualization

For `PARALLEL` steps and `CONDITIONAL` branches, add a **dependency graph** view that shows which steps feed into others. The current linear list layout doesn't clearly communicate that two steps run concurrently.

---

### 30. 🆕 Dark Mode Screenshot Preview Support

When viewing browser automation screenshots in the Execution Detail page, add a **lightbox / fullscreen viewer** with zoom support. Currently screenshots appear inline at fixed dimensions with no way to expand them.

---

### 31. 🆕 Test Case Import Progress Indicator

When importing a test case from OpenAPI or YAML, the import dialog shows validation results but no progress indicator during the actual import operation. Add a step-by-step progress toast.

---

### 32. 🆕 Empty State Illustrations

Several empty states (no test cases, no executions) show only an icon and text. Replacing these with **custom SVG illustrations** (or a single reusable `EmptyState` component) would make the app feel more polished and guide users toward the next action with CTAs.

---

## 📊 Priority Matrix

| # | Issue / Feature | Area | Priority | Effort |
|---|----------------|------|----------|--------|
| 1 | Fix fake dashboard trend chart data | Dashboard | 🔴 Critical | Medium |
| 2 | Pagination on Execution List | Executions | 🔴 Critical | Medium |
| 3 | Search/filter on Execution List | Executions | 🔴 Critical | Low |
| 4 | Resolve UUID segments in breadcrumbs | Navigation | 🔴 Critical | Medium |
| 5 | Show/hide password toggle | Login | 🟠 High | Low |
| 6 | Loading spinner on login button | Login | 🟠 High | Low |
| 7 | Sidebar icon tooltips in collapsed mode | Navigation | 🟠 High | Low |
| 8 | Quick Actions panel on Dashboard | Dashboard | 🟠 High | Low |
| 9 | "Unsaved changes" navigation guard | Designer | 🟠 High | Medium |
| 10 | Avg Duration stat card on Dashboard | Dashboard | 🟠 High | Low |
| 11 | Richer context menu on canvas nodes | Designer | 🟠 High | Low |
| 12 | Step duration chart axis labels | Executions | 🟠 High | Low |
| 13 | Tab state in URL query params | App Detail | 🟡 Medium | Low |
| 14 | Last run status dot on test case cards | App Detail | 🟡 Medium | Medium |
| 15 | Delete confirmation dialogs | Global Config | 🟡 Medium | Low |
| 16 | Step search in designer panel | Designer | 🟡 Medium | Low |
| 17 | Download execution report (HTML/PDF) | Executions | 🟡 Medium | High |
| 18 | Relative timestamp in execution logs | Executions | 🟡 Medium | Low |
| 19 | Step type category tabs in selector | Designer | 🟡 Medium | Medium |
| 20 | Theme toggle with CSS transition | Global | 🟡 Medium | Low |
| 21 | Notification/Alert center | Header | 🟢 Low | High |
| 22 | Clickable tag filters | App Detail | 🟢 Low | Low |
| 23 | Keyboard shortcuts reference page | Global | 🟢 Low | Medium |
| 24 | Execution comparison view | Executions | 🟢 Low | High |
| 25 | Inline `{{variable}}` preview tooltip | Designer | 🟢 Low | Medium |
| 26 | Lightbox for screenshot viewer | Executions | 🟢 Low | Low |
| 27 | Profile avatar upload | Settings | 🟢 Low | Medium |
| 28 | Reusable `<EmptyState>` component | Global | 🟢 Low | Low |

---

## 🛠 Suggested Reusable Components to Build

These components would improve consistency across the entire app:

| Component | Purpose |
|-----------|---------|
| `<EmptyState icon title description cta />` | Consistent empty state UI across all list pages |
| `<ConfirmDialog title description onConfirm />` | Reusable delete/destructive action confirmation |
| `<PaginationBar page size total onChange />` | Standard paginated table controls |
| `<StatCard label value icon color trend />` | Consistent Dashboard KPI tiles |
| `<SearchInput placeholder onSearch />` | Debounced search input component |
| `<Lightbox src />` | Fullscreen image viewer for screenshots |
| `<TagBadge label onClick />` | Clickable tag badges with filter callbacks |

---

*This document was auto-generated by reviewing the ORION frontend source code. Update as improvements are implemented.*
