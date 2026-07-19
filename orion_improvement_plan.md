# Orion — Improvement Plan (Reviewed & Updated)

> Reviewed: 2026-07-19 | User-approved plan after comment review

---

## 🔴 Critical / Quick Wins (High Impact, Low Effort)

### 1. Breadcrumb UUID Resolution ✅
**Where**: `Header.tsx`  
URLs like `/applications/a1b2c3d4-xxx/testcases/xxx/designer` show raw UUIDs in the breadcrumb. Users can't tell which app or test case they're viewing.  
**Fix**: Resolve entity names from React Query cache and display `Applications / My App / Login Flow / Designer` throughout all nested routes.

---

### 2. Execution Timeout Guard ✅
**Where**: `ExecutionEngine.java`, `System Settings`  
A hanging HTTP call can freeze a worker thread indefinitely with no timeout.  
**Fix**:
- Introduce `maxExecutionTimeoutMs` configurable in **Admin Settings**
- **Default: 30 seconds** per step execution
- On timeout, forcibly mark the step as `FAILED` with message `"Step timed out after 30s"` and the execution as `CANCELLED`
- Also add a global test-case level timeout (default: 10 minutes)

---

### 3. Real-Time Execution Progress Bar ✅
**Where**: `ExecutionDetailPage.tsx`  
The execution detail page has step-level SSE streaming but no global progress indicator.  
**Fix**:
- Compute `progressPct = completedSteps / totalSteps * 100`
- Render an animated progress bar at the top of the execution detail page showing `"Step 3 of 10"`
- Color transitions: blue (running) → green (passed) → red (failed)

---

### 4. Test Case Clone / Duplicate ✅
**Where**: `ApplicationDetailPage.tsx`, `TestCaseService.java`  
No "Clone" or "Duplicate" option exists. Users manually recreate all steps.  
**Fix**:
- Add `POST /applications/{appId}/testcases/{tcId}/clone` endpoint that deep-copies test case + all steps
- New copy gets name: `{original name} (Copy)` with `DRAFT` status
- Add **"Duplicate"** option in the test case 3-dot menu

---

### 5. Bulk Step Enable / Disable / Delete ✅
**Where**: `ApplicationDetailPage.tsx` (Workflow Designer)  
Users can only enable/disable one step at a time — tedious for large test cases (30+ steps).  
**Fix**:
- Add checkbox multi-select to step cards in the workflow designer list
- Show a floating action toolbar when ≥1 step is selected: `Enable All | Disable All | Delete Selected`
- "Select All" and "Clear Selection" shortcuts in the toolbar

---

### 6. Per–Test Case Execution History Panel ✅
**Where**: `ApplicationDetailPage.tsx`  
No execution history is visible inside the test case designer — users can't compare this run to previous ones.  
**Fix**:
- Add a collapsible **"Run History"** panel in the test case detail tab
- Show last 5 runs: timestamp, status badge (PASSED/FAILED), duration, triggered-by user
- Click a past run to open it in the execution detail page

---

## 🟠 High Priority (Medium Effort)

### 7. Execution Trend Analytics Dashboard ✅
**Where**: `DashboardPage.tsx`, `DashboardController.java`  
Dashboard shows a 7-day trend chart but lacks per-app breakdown, flakiness scoring, and MTTF.  
**Fix**:
- Add **Pass Rate % ring chart** per application on the app list cards
- Add **Flakiness Score** on the test case list (steps that alternate pass/fail in the last 10 runs)
- Add **Mean Time to Fix (MTTF)** — duration from first failure to next pass in execution history
- Add **date range filter** on the trend chart: 7d / 30d / 90d
- Add **execution queue depth** metric card showing current active vs queued

---

### 8. Export / Import Test Cases (YAML / JSON) ✅
**Where**: `TestCaseService.java`, `ApplicationDetailPage.tsx`  
Test cases can't be shared between apps or version-controlled in Git.  
**Fix**:
- `GET /applications/{appId}/testcases/{tcId}/export?format=yaml` — portable YAML with all steps
- `POST /applications/{appId}/testcases/import` — re-creates test case from YAML
- Add **Export YAML** button and **Import from YAML** button on the test case list

---

### 9. Global Variables / Secrets Vault ✅
**Where**: New `GlobalVaultPage.tsx`, extend `GlobalEnvConfigRepository.java`  
No cross-app shared vault for tokens like `{{sharedAdminToken}}`, `{{internalApiKey}}`.  
**Fix**:
- New `global_variables` table: key, encrypted value, description, created_by
- Variable resolution order at runtime: **Global Vault → Environment → Execution Context**
- Secrets masked as `••••••••` in execution logs and in the UI
- RBAC: ADMIN can create/update; all users can consume at runtime

---

### 10. Test Suite Improvements ✅
**Where**: `TestSuiteService.java`, `TestSuiteController.java`  
Suites support cron scheduling but lack stop-on-failure, parallelism, and run-order control.  
**Fix**:
- Add `stopOnFirstFailure: boolean` field to `TestSuite` entity (default: false)
- Add `parallelism: int` field — run N test cases concurrently within a suite (default: 1)
- Add test case ordering within a suite (drag-and-drop order)
- Add dedicated **suite run result page** showing per-test-case pass/fail breakdown

---

### 11. Environment Variable Diff / Compare ✅
**Where**: New `EnvironmentCompareModal.tsx`  
No way to compare Dev vs Staging vs Prod variable keys side-by-side.  
**Fix**:
- Multi-select environments in a diff modal on the Environment settings page
- Table view: columns = environments, rows = variable keys
- Color coding: 🟢 present in all environments, 🟡 missing in some, 🔴 missing in most
- One-click button to copy a value from one environment to another

---

### 12. Step Retry on Failure ✅
**Where**: `ExecutionEngine.java`, `TestStep.java`  
Flaky HTTP endpoints cause false negatives. No built-in retry.  
**Fix**:
- Add `retryCount: int` (default: 0, **max: 3**) and `retryDelayMs: int` (default: 1000) to `TestStep`
- `ExecutionEngine` retries the step N times before marking it FAILED
- Step log output shows attempt number: `"Attempt 2 of 3 failed — retrying in 1000ms"`
- Configurable per step via step config panel

---

### 13. Step Library / Template Marketplace ✅
**Where**: Extend `GlobalStep`, new `StepTemplateService.java`, `StepLibraryPanel.tsx`  
Common patterns (OAuth2 login, JWT decode, health check) are recreated in every application.  
**Fix**:
- Pre-built parameterized step templates stored in a `step_templates` table
- Users click **"Use Template"** from the step type selector → fills in parameter values → inserts ready step
- Orion ships with built-in templates: `OAuth2 Login`, `JWT Decode & Store`, `Pagination Loop`, `Health Check`, `Assert Non-Empty List`

---

### 14. Test Coverage Heat Map on Canvas ✅
**Where**: `StepNode.tsx`, new `CoverageOverlay.tsx`  
Canvas shows current run status per step but no historical coverage view.  
**Fix**:
- Toggle **"Coverage Mode"** button on the workflow canvas toolbar
- Color nodes by failure rate from execution history: green (stable) → yellow (flaky) → red (frequently failing)
- Node tooltip shows: `"Failed 3 of last 10 runs (30% failure rate)"`
- Execution frequency indicator: thicker border = run more often

---

### 15. Test Data Management (TDM) Page ✅
**Where**: New `TestDataPage.tsx`, `TestDatasetService.java`  
CSV datasets are embedded inline in steps — hard to discover, reuse or update.  
**Fix**:
- Dedicated **Test Data** page per application
- Upload, version and tag named CSV datasets
- Reference a dataset by name in `CSV_EXTRACT` step config instead of inlining raw CSV
- Support faker-style generated placeholder values: `{{faker.email}}`, `{{faker.uuid}}`, `{{faker.name}}`

---

## 🔵 Technical Debt / Quality

### 16. API Rate Limiting ✅
**Where**: `SecurityConfig.java`  
No rate limiting exists. A rogue client could spam execution triggers and saturate the thread pool.  
**Fix**:
- Add Bucket4j rate limiting: max 10 execution triggers per minute per user, max 100 API calls per minute per IP
- Return `429 Too Many Requests` with `Retry-After` header when limit exceeded
- Rate limit configuration exposed in Admin Settings

---

### 17. Proper HTTP Error Response Structure ✅
**Where**: `GlobalExceptionHandler.java`  
Some exceptions return Spring's default 500 HTML body instead of structured JSON.  
**Fix**:
- Ensure all exceptions map to `{ "error": "...", "message": "...", "status": 4xx }` JSON via `@RestControllerAdvice`
- Add problem-specific codes: `NOT_FOUND`, `VALIDATION_FAILED`, `EXECUTION_TIMEOUT`, `UNAUTHORIZED`
- Consistent error format across all endpoints

---

### 18. Frontend Performance Optimization ✅
**Where**: `ApplicationDetailPage.tsx`, `ExecutionDetailPage.tsx`, `WorkflowDesigner`  
Focus on **runtime performance**, not bundle size:
- **Virtual scrolling** on execution step logs — currently renders all 100+ log rows into DOM causing jank
- **Memoization** (`useMemo`, `useCallback`) on `StepNode` re-renders in the workflow canvas
- **Debounce** SSE event processing — high-frequency execution updates should batch DOM updates
- **Lazy-load** the Monaco editor only when a YAML/Script step config panel is opened

---

### 19. DB Performance Indexes ✅
**Where**: New Flyway migration `V24__add_performance_indexes.sql`  
As execution history grows, queries on `execution_step_logs` and `executions` will degrade without indexes.  
**Fix**: Add composite indexes:
```sql
CREATE INDEX idx_esl_exec_seq ON execution_step_logs(execution_id, sequence_order);
CREATE INDEX idx_exec_app_status ON executions(app_id, status, started_at DESC);
CREATE INDEX idx_tc_app_status ON test_cases(app_id, status, updated_at DESC);
```

---

### 20. Single-User Edit Protection ✅
**Where**: `TestCaseService.java`, `ApplicationDetailPage.tsx`  
Two browser tabs (same user) editing the same test case simultaneously can overwrite each other.  
**Fix**:
- Optimistic locking using `version` field (already present in `TestCase.java`)
- If save is attempted with a stale `version`, return `409 Conflict` with a diff showing what changed
- Frontend shows a modal: `"This test case was updated in another tab. Reload to see latest changes."`

---

## 🟣 Explore Later

| # | Feature | Effort | Impact |
|---|---------|--------|--------|
| 21 | **Tag-based bulk runner** — run all test cases tagged `smoke` in one click | Low | High |
| 22 | **Environment promotion wizard** — promote variables from Dev → Staging → Prod via UI | Medium | High |
| 23 | **Audit log export** — export audit trail as CSV/PDF for compliance teams | Low | Medium |
| 24 | **Dark/Light theme toggle** — user-level preference stored in profile | Low | Medium |
| 25 | **Mobile-friendly execution viewer** — responsive layout for execution detail page | Medium | Medium |
| 26 | **SAML / SSO integration** — enterprise login via Okta / Azure AD | High | High |
| 27 | **Test case inline comments** — annotations on test steps for documentation | Low | Medium |

---

## 📊 Implementation Priority Order

| Sprint | Items | Goal |
|--------|-------|------|
| **Sprint 1** | #1 Breadcrumbs, #3 Progress Bar, #4 Clone, #5 Bulk Steps, #6 Run History | UX polish — fast wins |
| **Sprint 2** | #2 Timeout Guard, #12 Step Retry, #17 Error Responses, #19 DB Indexes | Stability & reliability |
| **Sprint 3** | #7 Analytics Dashboard, #8 Export/Import, #10 Test Suites | Power user features |
| **Sprint 4** | #9 Secrets Vault, #11 Env Diff, #15 TDM Page | Data management |
| **Sprint 5** | #13 Step Library, #14 Heat Map, #16 Rate Limiting, #18 Performance, #20 Edit Lock | Quality & advanced features |
