# Orion Regression Test Application — Improvement Roadmap

## What the App Currently Has

| Area | Current State |
|---|---|
| **Step Types** | HTTP, Assertion, Delay, SetVariable, Conditional, Loop, Script, Log, DatabaseQuery, Parallel, SOAP, DBTableView, BrowserAutomation, CsvExtract, MainframeTerminal, ResponseProcessor |
| **Execution** | Async engine, SSE streaming, cancel, rerun, step filtering |
| **Reporting** | Basic stats (pass rate, avg duration), 7/30-day trend |
| **Test Case** | Priority, Status (DRAFT/READY/DEPRECATED), Tags |
| **DB Layer** | Flyway migrations V1–V18, JPA entities |
| **Testing** | ⚠️ **Zero unit/integration tests exist** |

---

## Priority 1 — Critical Gaps (High Impact)

### 1.1 Test Coverage (Currently ZERO)

The `src/test/java/` directory is empty. This is the most critical gap.

**What to build:**

```
src/test/java/com/axon/orion/
├── execution/
│   ├── ExecutionServiceTest.java           ← Unit tests for triggerExecution, cancel, rerun
│   ├── ExecutionEngineTest.java            ← Unit tests per step executor
│   └── engine/
│       ├── HttpRequestExecutorTest.java
│       ├── AssertionExecutorTest.java
│       ├── DatabaseQueryExecutorTest.java
│       └── ConditionalExecutorTest.java
├── testcase/
│   ├── TestCaseServiceTest.java
│   └── TestStepServiceTest.java
└── integration/
    ├── ExecutionIntegrationTest.java       ← @SpringBootTest + H2
    └── TestCaseIntegrationTest.java
```

**Key test scenarios missing:**
- Variable interpolation (`{{varName}}`) edge cases
- Assertion failure correctly sets step `FAILED`
- Loop executor terminates on max iterations
- Conditional step branches correctly
- Re-run creates a new `Execution` linked to same test case
- SSE emitter cleanup on timeout

---

### 1.2 Scheduled / CI Test Runs

Currently executions are only **manually triggered**. Add:

- `@Scheduled` runner to trigger executions on a cron
- **Test Suite** entity grouping multiple test cases
- Batch execution with aggregate report

**New DB migration needed:**
```sql
-- V19
CREATE TABLE test_suites (id, app_id, name, description, cron_expression, environment_id, ...);
CREATE TABLE test_suite_cases (suite_id, test_case_id, sequence_order);
CREATE TABLE suite_executions (id, suite_id, status, triggered_by, started_at, ...);
```

---

### 1.3 Retry / Flakiness Handling

The `ExecutionEngine` has no retry logic. One transient network error fails the whole step.

**Add to `TestStep`:**
```java
@Column(name = "retry_count")
private int retryCount = 0;  // 0 = no retry

@Column(name = "retry_delay_ms")
private long retryDelayMs = 1000;
```

**Migration:**
```sql
-- V20
ALTER TABLE test_steps ADD COLUMN retry_count INT DEFAULT 0;
ALTER TABLE test_steps ADD COLUMN retry_delay_ms BIGINT DEFAULT 1000;
```

---

## Priority 2 — High Value Features

### 2.1 Assertion Improvements

Current assertion step covers basic cases. Missing:

| Missing Assertion | Why Important |
|---|---|
| `JSON Schema Validation` | Validate API response structure |
| `Array contains element` | Collections in responses |
| `Response time < X ms` | Performance regression detection |
| `Field count equals N` | Schema integrity |
| `XML Path assertion` | SOAP/XML APIs |
| `Soft assertions` | Don't fail immediately, collect all failures |

---

### 2.2 Data-Driven Testing

Currently test steps have static config. Add parameterized/data-driven execution:

- **CSV-driven**: run same test N times with different rows
- **Inline data table**: define rows in the UI

```java
// New StepType
DATA_DRIVEN   // reads CSV/JSON, iterates rows, runs child steps
```

*(CsvExtractExecutor already exists — extend it for full data-driven loops)*

---

### 2.3 Environment Baseline Comparison

When a regression run finishes, compare results against a **baseline** (previous passing run):

- Flag new failures that weren't failing before
- Flag newly passing steps (regression recovery)
- Store "baseline execution ID" per test case

---

### 2.4 Notification / Alerting

No alerting exists today. Add:

| Channel | Trigger |
|---|---|
| **Email** | On execution FAILED / PASSED |
| **Slack/Teams webhook** | On suite failure |
| **In-app notification** | Always |

A partial `EmailReportRequest` DTO already exists but is unused — wire it up.

---

## Priority 3 — Reporting & Analytics

### 3.1 Execution Report Export

| Format | Use Case |
|---|---|
| **PDF** | Share with stakeholders |
| **HTML** | Attach to CI pipeline |
| **JUnit XML** | Import into Jenkins/GitHub Actions |
| **CSV** | Data analysis |

### 3.2 Flakiness Report

Track steps that `PASS` and `FAIL` alternately across runs:
```sql
SELECT test_step_id, 
       COUNT(*) FILTER (WHERE status='PASSED') AS passes,
       COUNT(*) FILTER (WHERE status='FAILED') AS fails
FROM execution_step_logs
GROUP BY test_step_id
HAVING COUNT(*) FILTER (WHERE status='FAILED') > 0
   AND COUNT(*) FILTER (WHERE status='PASSED') > 0;
```

### 3.3 Performance Trending per Step

Currently `durationMs` is stored per step log. Add aggregation:
- Average response time per step across last N runs
- Detect steps that are getting slower (performance regression)

---

## Priority 4 — Developer Experience

### 4.1 Test Case Versioning

When a test case's steps are modified, the current design loses history. Add:
```sql
-- V21
ALTER TABLE test_cases ADD COLUMN version INT DEFAULT 1;
CREATE TABLE test_case_snapshots (id, test_case_id, version, snapshot_json, ...);
```
Link executions to a specific version/snapshot.

### 4.2 Clone / Template Test Cases

- Clone a test case (steps + config) as a starting point
- "Test Case Templates" shared across apps

### 4.3 Import / Export

- Export test case as JSON/YAML (portable)
- Import from Postman Collection, OpenAPI spec, or another app
- `TestCaseImportService` already exists — extend it

### 4.4 Step Dependency Graph

Visualize which steps extract variables consumed by later steps — helps debug `Variable 'X' not defined` errors before execution.

---

## Priority 5 — Security & Operations

### 5.1 RBAC for Executions

Currently any user can trigger/cancel any execution. Add:
- `VIEWER`: read-only
- `TESTER`: trigger + view
- `ADMIN`: full control including delete

### 5.2 Execution Timeout

No global timeout guard in `ExecutionEngine`. A hanging HTTP step can block the thread pool forever. Add:
```java
@Column(name = "timeout_ms")
private Long timeoutMs;  // per-step and per-execution
```

### 5.3 Audit Log for Executions

Extend the existing `audit` module to log:
- Who triggered, cancelled, deleted executions
- Config changes to test cases/steps

---

## Implementation Order (Suggested)

```
Phase 1 (Now):    Unit + Integration Tests  ← eliminates zero-test risk
Phase 2 (Next):   Retry logic + Timeouts    ← stability
Phase 3:          Scheduled runs + Suites   ← automation
Phase 4:          Assertions improvements + Data-driven  ← coverage depth
Phase 5:          Reports export + Analytics ← visibility
Phase 6:          Versioning + RBAC         ← enterprise readiness
```

---

> **Quick Win**: The `EmailReportRequest` DTO and `TestCaseImportService` already exist — they just need to be wired to actual business logic. Both can be completed in under a day.
