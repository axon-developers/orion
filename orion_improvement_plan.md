# ORION — Full Project Improvement Plan

> Comprehensive review of the Orion Test Case Workflow Builder and Execution Platform.
> **73 Java files** · **35 TypeScript/TSX files** · Spring Boot 3.3 + React 18 + Vite + SQLite

---

## Table of Contents

1. [Architecture & Structural Issues](#1-architecture--structural-issues)
2. [Backend Improvements](#2-backend-improvements)
3. [Frontend Improvements](#3-frontend-improvements)
4. [Security Hardening](#4-security-hardening)
5. [Testing & Quality](#5-testing--quality)
6. [Performance & Scalability](#6-performance--scalability)
7. [DevOps & Deployment](#7-devops--deployment)
8. [New Feature Opportunities](#8-new-feature-opportunities)

---

## 1. Architecture & Structural Issues

### 1.1 Timestamps stored as `String` instead of `Instant`

| Severity | Files Affected |
|----------|---------------|
| 🔴 High | [BaseEntity.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/common/entity/BaseEntity.java), [Execution.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/entity/Execution.java), [ExecutionStepLog.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/entity/ExecutionStepLog.java) |

All timestamp fields (`createdAt`, `updatedAt`, `startedAt`, `completedAt`) are stored as `String` and manually converted via `Instant.now().toString()`. This causes:
- Broken time-zone handling and sorting
- Inefficient comparison in queries
- No database-level temporal indexing

**Fix:** Change to `Instant` type with proper JPA `@Column(columnDefinition = "TIMESTAMP")` and add a custom `AttributeConverter` for SQLite compatibility.

---

### 1.2 JSON-in-column anti-pattern for structured data

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [Environment.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/environment/entity/Environment.java), [TestStep.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/testcase/entity/TestStep.java) |

`Environment` stores `variables`, `dbConnections`, and `certificates` as JSON text columns. `TestStep` stores `config` as a JSON text column. This blocks:
- Referential integrity (e.g., cascading cert deletes)
- Database-level queries (e.g., "find all environments using PostgreSQL")
- Type safety in the Java layer

**Fix (phased):**
- **Phase 1:** Create dedicated `@Embeddable` or child entity tables for `EnvironmentDatabase`, `EnvironmentCertificate`, `EnvironmentVariable` with `@OneToMany` relationships.
- **Phase 2:** For `TestStep.config`, keep JSON but add a typed `StepConfig` sealed-interface hierarchy with Jackson `@JsonTypeInfo` so deserialization is type-safe.

---

### 1.3 No Executor interface / Strategy pattern

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | All 8 executor classes in [engine/](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine) |

Each executor (`HttpRequestExecutor`, `AssertionExecutor`, `DatabaseQueryExecutor`, etc.) has no shared interface. The [ExecutionEngine.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/ExecutionEngine.java) dispatches via a giant `switch` statement and hardcoded field injection for every new executor.

**Fix:** Define a `StepExecutor` interface:

```java
public interface StepExecutor {
    StepResult execute(TestStep step, Map<String, Object> config, Map<String, String> context);
    Set<TestStep.StepType> supportedTypes();
}
```

Register executors in a `Map<StepType, StepExecutor>` via Spring auto-discovery. Adding a new step type then requires zero changes to `ExecutionEngine`.

---

### 1.4 Monolith StepConfigPanel.tsx (1,171 lines)

| Severity | Files Affected |
|----------|---------------|
| 🔴 High | [StepConfigPanel.tsx](file:///d:/Projects/orion/orion-frontend/src/components/workflow/StepConfigPanel.tsx) |

This single file contains config UI for every step type in one massive `switch/case` block. It is:
- Hard to navigate and maintain
- Impossible to lazy-load individual step configs
- A merge-conflict magnet

**Fix:** Extract each step type's config into its own component:
```
workflow/step-configs/
  HttpRequestConfig.tsx
  AssertionConfig.tsx
  DatabaseQueryConfig.tsx
  DbTableViewConfig.tsx
  DelayConfig.tsx
  LogConfig.tsx
  ...
```
Then use a registry map in `StepConfigPanel`:
```tsx
const configRegistry: Record<string, React.FC<StepConfigProps>> = {
  'HTTP_REQUEST': HttpRequestConfig,
  'DATABASE_QUERY': DatabaseQueryConfig,
  ...
};
```

---

## 2. Backend Improvements

### 2.1 Script execution is a no-op

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [ScriptExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/ScriptExecutor.java) |

The SCRIPT step only logs the text — it doesn't execute anything. This is V1 placeholder code.

**Fix:** Integrate GraalVM JavaScript engine (`org.graalvm.sdk:graal-sdk`) for sandboxed script execution. Inject the execution `context` map as a JavaScript global so users can write:
```javascript
if (statusCode === 200) { setVariable('token', body.accessToken); }
```

---

### 2.2 Conditional and Loop steps are stubs

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [ExecutionEngine.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/ExecutionEngine.java) (lines 277-290) |

`executeConditional` evaluates the condition but doesn't conditionally skip/run child steps. `executeLoop` just records metadata without actually looping.

**Fix:**
- **Conditional:** Implement true branch execution. If condition is true, execute the next step; if false, skip it (or execute an `else` step if present).
- **Loop:** Actually iterate `count` times (or over `dataSource` array), executing the next step group in each iteration and collecting results.

---

### 2.3 Database connections opened and closed per-query

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [DatabaseQueryExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/DatabaseQueryExecutor.java) |

Every `DATABASE_QUERY` / `DB_TABLE_VIEW` step opens a new JDBC connection, runs the query, and closes it. For test cases with 10+ DB steps against the same database, this is wasteful.

**Fix:** Introduce an `ExecutionConnectionPool` scoped to the execution lifecycle:
- Before execution starts, open connections for all referenced database keys.
- Share connections across steps within the same execution.
- Close all connections when the execution completes (in a `finally` block).

---

### 2.4 `ObjectMapper` instantiated inline in `HttpRequestExecutor`

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [HttpRequestExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/HttpRequestExecutor.java) (line 50) |

A `new ObjectMapper()` is created every time headers are parsed from a JSON string. This bypasses Spring's pre-configured `ObjectMapper`.

**Fix:** Inject the shared `ObjectMapper` via constructor (it's already a Spring bean).

---

### 2.5 Query params not URL-encoded

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [HttpRequestExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/HttpRequestExecutor.java) (lines 64-69) |

Query parameter values are appended to the URL without encoding:
```java
urlBuilder.append(k).append("=").append(v).append("&");
```
This will break for values containing `&`, `=`, spaces, or Unicode.

**Fix:** Use `java.net.URLEncoder.encode(v, StandardCharsets.UTF_8)`.

---

### 2.6 `timeout` config not wired

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [HttpRequestExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/HttpRequestExecutor.java) (line 61) |

`int timeoutMs = ((Number) config.getOrDefault("timeoutMs", 30000)).intValue();` is computed but never applied to the `RestClient` request. All requests use the default (infinite) timeout.

**Fix:** Create a per-request `RestClient` or use `HttpClient.Builder.connectTimeout()` + `readTimeout()` to honor the configured timeout.

---

### 2.7 No retry / back-off mechanism

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [HttpRequestExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/HttpRequestExecutor.java) |

HTTP requests have no retry capability. For flaky APIs (e.g., rate-limited endpoints), a configurable retry with exponential back-off would prevent false failures.

**Fix:** Add `retryCount` and `retryDelayMs` config fields and wrap execution in a retry loop.

---

### 2.8 `ExecutionService` validation is too large

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [ExecutionService.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/service/ExecutionService.java) (596 lines) |

The validation logic (`validateTestCaseExecution`) mixes HTTP step validation, DB connection validation, parallel sub-step validation, and variable tracking in one ~100-line method with deeply nested `if` blocks.

**Fix:** Extract into a `TestCaseValidator` service with modular per-step-type validators that mirror the `StepExecutor` pattern.

---

### 2.9 Missing pagination/limit on ExecutionStepLog queries

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [ExecutionStepLogRepository](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/repository) |

`findByExecutionIdOrderBySequenceOrderAsc` loads all step logs into memory. For executions with thousands of loop iterations, this causes OOM.

**Fix:** Add streaming (`Stream<ExecutionStepLog>`) or pagination to large log queries.

---

## 3. Frontend Improvements

### 3.1 No loading/error boundaries

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | All page components |

Pages individually check `isLoading` and `isError`, often with no error fallback. An unhandled React error crashes the entire app.

**Fix:**
- Add a global `<ErrorBoundary>` wrapper around `<Routes>`.
- Create a shared `<PageSkeleton>` component for consistent loading states.
- Add `react-query` global error handler to surface API failures via `toast`.

---

### 3.2 No code splitting / lazy loading

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [App.tsx](file:///d:/Projects/orion/orion-frontend/src/App.tsx) |

All 12+ pages are eagerly imported, increasing the initial bundle size. The workflow designer and execution detail page are heavy and rarely needed on first load.

**Fix:** Wrap page imports with `React.lazy()` + `<Suspense>`:
```tsx
const WorkflowDesignerPage = React.lazy(() => import('./pages/testcases/WorkflowDesignerPage'));
```

---

### 3.3 Dashboard polls every 5 seconds unconditionally

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [DashboardPage.tsx](file:///d:/Projects/orion/orion-frontend/src/pages/dashboard/DashboardPage.tsx) (lines 29, 39) |

Two API calls fire every 5 seconds regardless of whether the user is viewing the page or tab is active.

**Fix:** Use `refetchOnWindowFocus: true` instead of `refetchInterval`, or gate the interval with `document.visibilityState`:
```tsx
refetchInterval: document.hidden ? false : 5000
```

---

### 3.4 API calls inline in every component

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | All pages |

API calls are written inline with `useQuery`/`useMutation` inside every page. There's no service layer abstraction.

**Fix:** Create dedicated hooks per domain:
```
hooks/
  useApplications.ts    → useApplicationList(), useApplicationDetail(id)
  useExecutions.ts      → useExecutionList(), useExecutionDetail(id), useTriggerExecution()
  useEnvironments.ts    → useEnvironmentsByApp(appId)
```

---

### 3.5 `config: any` type across the entire frontend

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [api.ts](file:///d:/Projects/orion/orion-frontend/src/types/api.ts) (lines 91, 167), [workflow-store.ts](file:///d:/Projects/orion/orion-frontend/src/stores/workflow-store.ts) |

`TestStepDto.config` and `GlobalTestStepDto.config` are typed as `any`, disabling all TypeScript safety for the most critical data structure in the app.

**Fix:** Create discriminated union types:
```typescript
type HttpRequestConfig = { method: string; url: string; headers?: Record<string, string>; ... };
type DatabaseQueryConfig = { databaseKey?: string; connectionString?: string; query: string; ... };
type StepConfig = HttpRequestConfig | DatabaseQueryConfig | ...;
```

---

### 3.6 No form validation library

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [StepConfigPanel.tsx](file:///d:/Projects/orion/orion-frontend/src/components/workflow/StepConfigPanel.tsx) and all forms |

All forms use raw `onChange` handlers with no validation. Users can submit empty URLs, invalid JDBC strings, etc.

**Fix:** Adopt `react-hook-form` + `zod` for schema-based validation with auto-generated error messages.

---

### 3.7 UI component library in a single 314-line file

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [ui/index.tsx](file:///d:/Projects/orion/orion-frontend/src/components/ui/index.tsx) |

All UI primitives (Button, Input, Select, Dialog, Card, Badge, etc.) live in one barrel file.

**Fix:** Split into individual files under `ui/` and re-export from `ui/index.ts`:
```
ui/
  Button.tsx
  Input.tsx
  Select.tsx
  Dialog.tsx
  Card.tsx
  Badge.tsx
  Switch.tsx
  Textarea.tsx
  index.ts   ← re-exports
```

---

## 4. Security Hardening

### 4.1 Database credentials stored as plaintext in Environment JSON

| Severity | Files Affected |
|----------|---------------|
| 🔴 High | [Environment.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/environment/entity/Environment.java), [DatabaseQueryExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/DatabaseQueryExecutor.java) |

Database passwords, connection strings, and certificate contents are stored as plain text in the `db_connections` and `certificates` JSON columns.

**Fix:**
- Encrypt sensitive fields with AES-256 at rest using a master key (from env var / vault).
- Decrypt only at execution time, never return plaintext passwords to the frontend API.
- Add a `EncryptionService` to handle transparent encrypt/decrypt.

---

### 4.2 JWT secret may be hardcoded

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | `auth/` package |

Verify that the JWT signing key is loaded from an environment variable or secret manager — never hardcoded in `application.properties`.

---

### 4.3 CORS allows wildcard headers

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [SecurityConfig.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/config/SecurityConfig.java) (line 67) |

`config.setAllowedHeaders(List.of("*"))` allows any header. Combined with `setAllowCredentials(true)`, this can enable CSRF-like attacks.

**Fix:** Restrict to the specific headers the frontend sends: `Authorization`, `Content-Type`, `Accept`.

---

### 4.4 XPath injection in AssertionExecutor

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [AssertionExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/AssertionExecutor.java) (line 109) |

XPath expressions are executed against raw XML without sanitization. A malicious XPath could read system properties.

**Fix:** Set `XPathFactory` security features to disallow external entity access:
```java
factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
```

---

### 4.5 SQL injection risk in DatabaseQueryExecutor

| Severity | Files Affected |
|----------|---------------|
| 🔴 High | [DatabaseQueryExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/DatabaseQueryExecutor.java) |

User-supplied SQL queries are executed via `Statement.execute(query)` with no protection. While this is "by design" (the tool runs arbitrary SQL), consider:
- Adding a read-only mode option (prepend `SET TRANSACTION READ ONLY` or use `READ_ONLY` connection)
- Logging all executed queries to the audit trail
- Adding query timeout limits (`stmt.setQueryTimeout(seconds)`)

---

## 5. Testing & Quality

### 5.1 Zero test files

| Severity | Files Affected |
|----------|---------------|
| 🔴 High | Project-wide |

There is no `src/test/` directory in the backend. Zero unit tests, zero integration tests.

**Fix (priority order):**
1. **Unit tests for executors:** Each executor has pure logic perfect for unit testing. Use JUnit 5 + Mockito.
2. **Integration tests for ExecutionEngine:** Use `@SpringBootTest` with an embedded H2/SQLite to run a real test case end-to-end.
3. **API controller tests:** Use `@WebMvcTest` with `MockMvc` for each controller.
4. **Frontend tests:** Add Vitest + React Testing Library for critical components (StepConfigPanel, WorkflowDesigner).

---

### 5.2 No logging standards

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | All executor files |

Some executors use `log.info`, others use `log.error`, with inconsistent message formats and MDC context.

**Fix:** Standardize structured logging with MDC fields:
```java
MDC.put("executionId", executionId);
MDC.put("stepId", step.getId());
MDC.put("stepType", step.getStepType().name());
```

---

## 6. Performance & Scalability

### 6.1 SQLite as production database

| Severity | Files Affected |
|----------|---------------|
| 🟡 Medium | [pom.xml](file:///d:/Projects/orion/orion-backend/pom.xml), `application.properties` |

SQLite is single-writer, file-locked. Under concurrent test executions, writes will block.

**Fix:** Support PostgreSQL as the production database (driver is already in pom.xml). Use Spring profiles:
- `application-dev.properties` → SQLite for local development
- `application-prod.properties` → PostgreSQL for deployment

---

### 6.2 Thread pool configuration is static

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [AsyncConfig.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/config/AsyncConfig.java) |

The execution thread pool is hardcoded at `core=5, max=20, queue=50`. Under heavy load, new executions will be silently rejected.

**Fix:** Make configurable via `application.properties`:
```properties
orion.execution.pool.core-size=5
orion.execution.pool.max-size=20
orion.execution.pool.queue-capacity=50
```
Add a `RejectedExecutionHandler` that marks the execution as `ERROR` instead of silently dropping.

---

### 6.3 RestClient cache is unbounded

| Severity | Files Affected |
|----------|---------------|
| 🟢 Low | [HttpRequestExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/HttpRequestExecutor.java) (line 30) |

`restClientCache` is a `ConcurrentHashMap` with no eviction. Over time, one `RestClient` per unique SSL configuration accumulates.

**Fix:** Use Caffeine or a bounded `LinkedHashMap` with LRU eviction (max ~50 entries).

---

## 7. DevOps & Deployment

### 7.1 No Docker configuration

Add `Dockerfile` for both backend and frontend, plus a `docker-compose.yml` for one-command startup:
```yaml
services:
  backend:
    build: ./orion-backend
    ports: ["8080:8080"]
  frontend:
    build: ./orion-frontend
    ports: ["5173:80"]
```

---

### 7.2 No CI/CD pipeline

Add `.github/workflows/ci.yml`:
- **Build & test backend:** `mvn clean verify`
- **Build & lint frontend:** `npm run build && npm run lint`
- **Type check frontend:** `npx tsc --noEmit`

---

### 7.3 No Flyway migrations

The database schema appears to be managed by Hibernate `ddl-auto`. This is dangerous for production as schema changes can cause data loss.

**Fix:** Switch to `ddl-auto=validate` and manage all schema changes through numbered Flyway migration scripts in `src/main/resources/db/migration/`.

---

## 8. New Feature Opportunities

| Feature | Priority | Description |
|---------|----------|-------------|
| **Test Suites** | 🔴 High | Group test cases into suites. Run all tests in a suite sequentially or in parallel. |
| **Scheduled Execution** | 🔴 High | Cron-based recurring test runs (e.g., nightly regression). Use Spring `@Scheduled` + a `ScheduledExecution` entity. |
| **Execution History Charts** | 🟡 Medium | Trend charts on the dashboard showing pass rate over time, average duration, flaky tests. |
| **Import/Export** | 🟡 Medium | Export test cases as JSON/YAML. Import from Postman collections, Swagger/OpenAPI specs. |
| **Webhooks / Notifications** | 🟡 Medium | Trigger webhooks on execution complete. Slack/Teams integration beyond email. |
| **Data-Driven Testing** | 🟡 Medium | Run the same test case against a CSV/JSON dataset (parameterized execution). |
| **Execution Comparison** | 🟢 Low | Diff two executions side-by-side to spot regressions. |
| **Dark/Light Theme Toggle** | 🟢 Low | The app is dark-mode only. Add a theme toggle with system preference detection. |
| **GraphQL Step Type** | 🟢 Low | Dedicated GraphQL request step with schema introspection. |
| **gRPC Step Type** | 🟢 Low | gRPC unary call support using proto definitions. |

---

## Summary Priority Matrix

| Priority | Count | Items |
|----------|-------|-------|
| 🔴 **Critical** | 6 | Timestamps as strings, monolith StepConfigPanel, plaintext credentials, SQL injection risks, zero tests, DB migrations |
| 🟡 **Important** | 12 | JSON-in-column, executor interface, stub steps, validation extraction, error boundaries, code splitting, typed configs, XPath injection, URL encoding, connection pooling, SQLite prod, API hooks |
| 🟢 **Nice-to-have** | 9 | Inline ObjectMapper, timeout wiring, retry mechanism, logging standards, thread pool config, RestClient cache, polling optimization, form validation, UI file split |
