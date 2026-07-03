# ORION — Implementation Plan

Full-stack implementation plan for the ORION Test Case Workflow Builder & Execution Platform, based on the [ORION_REQUIREMENTS.md](file:///d:/Projects/orion/ORION_REQUIREMENTS.md).

---

## User Review Required

> [!IMPORTANT]
> This is a large full-stack project (Spring Boot 4 + React 19 / Vite / shadcn/ui). The plan is broken into **12 phases** executed sequentially. Each phase produces a working, testable increment. Please review the phase ordering, scope, and any open questions before approving.

> [!WARNING]
> **SQLite + Flyway**: Flyway's SQLite support has known limitations (no `ALTER COLUMN`, limited `DROP COLUMN`). Migrations will use SQLite-compatible DDL only (create table, add column, create index). Schema changes that SQLite doesn't support will be handled via the "create new table → copy data → drop old → rename" pattern.

> [!WARNING]
> **Spring Boot 4.0.7**: This is a very recent version. Some third-party libraries (Flyway, JJWT, Hibernate community dialects) may need version pinning or compatibility patches. I'll verify during project setup and adjust if needed.

## Open Questions

1. **State Management**: The requirements list "Zustand or React Context". I'll default to **Zustand** for global state (auth, sidebar) and **TanStack Query** for server state (API data caching/fetching). Is this acceptable?
2. **Execution Engine Scope**: The execution engine will simulate HTTP calls (logging the configured request/response) in V1 rather than making actual external HTTP calls. Should it make **real HTTP calls** from the backend, or should it be a simulation/mock for V1?
3. **Real-time Updates**: Requirements mention SSE (Server-Sent Events) for execution progress. Should I implement full SSE, or start with **polling** (simpler, works with SQLite's single-writer) and add SSE as an enhancement?
4. **Seed Data**: The sample application + demo test case is marked "optional". Should I include it?

---

## Proposed Changes

The implementation is divided into 12 phases. Each phase builds on the previous and produces a testable, runnable increment.

---

### Phase 1: Project Scaffolding & Infrastructure

Set up the monorepo structure, build tools, and core configurations for both backend and frontend.

---

#### [NEW] `orion-backend/pom.xml`
Maven POM with all dependencies: Spring Boot 4.0.7, Spring Web, Spring Data JPA, Spring Security, Spring Validation, SQLite JDBC, Hibernate Community Dialects, Flyway, JJWT (0.12.6), Lombok, MapStruct, and test dependencies (JUnit 5, Mockito, Spring Boot Test).

#### [NEW] `orion-backend/src/main/java/com/axon/orion/OrionApplication.java`
Main Spring Boot application class with `@SpringBootApplication`.

#### [NEW] `orion-backend/src/main/resources/application.yml`
Configuration as specified in §5.6: SQLite datasource, JPA/Hibernate settings, Flyway, JWT secrets, CORS origins, server port.

#### [NEW] `orion-backend/src/main/resources/application-dev.yml`
Dev profile overrides (show-sql: true, debug logging).

#### [NEW] `orion-frontend/` (Vite project)
Scaffold via `npm create vite@latest ./ -- --template react-ts`. Then install: tailwindcss v4, shadcn/ui, react-router v7, zustand, @tanstack/react-query, axios, react-hook-form, zod, @hookform/resolvers, reactflow, lucide-react, sonner, framer-motion.

#### [NEW] `orion-frontend/src/lib/api.ts`
Axios instance with base URL from env, JWT interceptor (attach access token, handle 401 → refresh → retry).

#### [NEW] `orion-frontend/src/lib/utils.ts`
shadcn/ui utility functions (cn helper, etc.).

---

### Phase 2: Database Schema & Migrations

Create all Flyway migration scripts defining the complete database schema.

---

#### [NEW] `orion-backend/src/main/resources/db/migration/V1__create_users_table.sql`
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'TESTER',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

#### [NEW] `V2__create_applications_table.sql`
Applications table with id, name (unique), description, base_url, is_active, created_by (FK→users), timestamps.

#### [NEW] `V3__create_environments_table.sql`
Environments table with id, app_id (FK→applications), name, description, variables (JSON text), is_active, created_by (FK→users), timestamps. Unique constraint on (app_id, name).

#### [NEW] `V4__create_test_cases_table.sql`
Test cases table with id, app_id (FK), name, description, tags (JSON), priority, status, created_by (FK), timestamps.

#### [NEW] `V5__create_test_steps_table.sql`
Test steps table with id, test_case_id (FK), sequence_order, name, description, step_type, action_type, config (JSON), expected_result, is_global_ref, global_step_id (FK nullable), timestamps.

#### [NEW] `V6__create_executions_table.sql`
Executions table with all fields from §3.1 ER diagram.

#### [NEW] `V7__create_execution_step_logs_table.sql`
Execution step logs table with all fields from §3.1.

#### [NEW] `V8__create_global_env_configs_table.sql`
Global env configs table.

#### [NEW] `V9__create_global_test_steps_table.sql`
Global test steps table.

#### [NEW] `V10__create_audit_log_table.sql`
Audit log table: id, entity_type, entity_id, action (CREATE/UPDATE/DELETE), performed_by (FK), previous_value (JSON), new_value (JSON), timestamp.

#### [NEW] `V11__seed_admin_user.sql`
Insert default admin user (username: admin, email: admin@orion.local, BCrypt hash of "Admin@123", role: ADMIN).

---

### Phase 3: Common/Shared Backend Components

Base entity classes, DTOs, exception handling, and utility classes used by all modules.

---

#### [NEW] `common/entity/BaseEntity.java`
Abstract JPA entity with `id` (UUID string, auto-generated), `createdAt`, `updatedAt` with `@PrePersist`/`@PreUpdate` lifecycle hooks.

#### [NEW] `common/dto/PagedResponse.java`
Generic paginated response DTO matching the format in §5.3.

#### [NEW] `common/dto/ErrorResponse.java`
Error response DTO matching the format in §5.2.

#### [NEW] `common/exception/ResourceNotFoundException.java`
#### [NEW] `common/exception/DuplicateResourceException.java`
#### [NEW] `common/exception/UnauthorizedException.java`
#### [NEW] `common/exception/ForbiddenException.java`
#### [NEW] `common/exception/ExecutionException.java`
Custom exception classes.

#### [NEW] `common/exception/GlobalExceptionHandler.java`
`@RestControllerAdvice` handler mapping each custom exception + `MethodArgumentNotValidException` + generic `Exception` to the standardized error response format.

#### [NEW] `common/util/VariableInterpolator.java`
Utility to resolve `{{variableName}}` placeholders in strings and JSON objects using a variable context map.

#### [NEW] `audit/entity/AuditLog.java`
Audit log JPA entity.

#### [NEW] `audit/repository/AuditLogRepository.java`
#### [NEW] `audit/service/AuditService.java`
Audit logging service called from entity listeners and service methods.

#### [NEW] `audit/listener/AuditEntityListener.java`
JPA entity listener that auto-logs create/update/delete operations.

---

### Phase 4: Authentication & User Management (Backend)

JWT-based auth, Spring Security configuration, and the complete User module.

---

#### [NEW] `config/SecurityConfig.java`
Spring Security filter chain: stateless session, JWT authentication filter, public endpoints (/api/auth/**), role-based access rules, CORS configuration.

#### [NEW] `config/CorsConfig.java`
CORS configuration bean allowing the frontend origin.

#### [NEW] `auth/util/JwtUtil.java`
JWT utility: generate access/refresh tokens, validate tokens, extract claims (userId, role). Uses JJWT with HS512.

#### [NEW] `auth/filter/JwtAuthenticationFilter.java`
`OncePerRequestFilter` that extracts JWT from `Authorization` header, validates, and sets `SecurityContext`.

#### [NEW] `auth/dto/LoginRequest.java` / `LoginResponse.java` / `RegisterRequest.java` / `RefreshTokenRequest.java`
Auth DTOs.

#### [NEW] `auth/controller/AuthController.java`
Endpoints: POST /api/auth/register, /login, /refresh, /logout.

#### [NEW] `auth/service/AuthService.java`
Registration (BCrypt hashing, default role TESTER), login (validate credentials, generate tokens), refresh (validate refresh token, issue new access token).

#### [NEW] `user/entity/User.java`
User JPA entity with role enum (ADMIN, TESTER, VIEWER).

#### [NEW] `user/repository/UserRepository.java`
Spring Data JPA repository with `findByUsername`, `findByEmail`.

#### [NEW] `user/dto/UserDto.java` / `CreateUserRequest.java` / `UpdateUserRequest.java`
User DTOs (never expose passwordHash).

#### [NEW] `user/service/UserService.java`
User CRUD service: list (paginated), get by ID, update profile, change role, activate/deactivate, soft-delete.

#### [NEW] `user/controller/UserController.java`
All endpoints from §4.1: /api/users/**, /api/users/me/**.

---

### Phase 5: Application & Environment Management (Backend)

---

#### [NEW] `application/entity/Application.java`
Application JPA entity.

#### [NEW] `application/repository/ApplicationRepository.java`
With search/filter queries.

#### [NEW] `application/dto/ApplicationDto.java` / `CreateApplicationRequest.java` / `UpdateApplicationRequest.java` / `ApplicationSummaryDto.java`

#### [NEW] `application/service/ApplicationService.java`
CRUD + summary stats (env count, test case count, execution count).

#### [NEW] `application/controller/ApplicationController.java`
All endpoints from §4.2.

---

#### [NEW] `environment/entity/Environment.java`
Environment JPA entity with `variables` stored as JSON text.

#### [NEW] `environment/repository/EnvironmentRepository.java`

#### [NEW] `environment/dto/EnvironmentDto.java` / `CreateEnvironmentRequest.java` / `EnvironmentVariableDto.java`

#### [NEW] `environment/service/EnvironmentService.java`
CRUD + clone + variable resolution (merge with globals, mask secrets).

#### [NEW] `environment/controller/EnvironmentController.java`
All endpoints from §4.3 nested under `/api/applications/{appId}/environments`.

---

### Phase 6: Test Case & Test Step Management (Backend)

---

#### [NEW] `testcase/entity/TestCase.java`
TestCase JPA entity with tags (JSON), priority enum, status enum.

#### [NEW] `testcase/entity/TestStep.java`
TestStep JPA entity with stepType enum, actionType enum, config (JSON), globalStepId reference.

#### [NEW] `testcase/repository/TestCaseRepository.java` / `TestStepRepository.java`

#### [NEW] `testcase/dto/TestCaseDto.java` / `CreateTestCaseRequest.java` / `TestStepDto.java` / `CreateTestStepRequest.java` / `ReorderRequest.java`

#### [NEW] `testcase/service/TestCaseService.java`
CRUD + clone + import/export JSON + filtering by name/tag/priority/status.

#### [NEW] `testcase/service/TestStepService.java`
CRUD + reorder + bulk save + global step reference resolution.

#### [NEW] `testcase/controller/TestCaseController.java`
Endpoints from §4.4.

#### [NEW] `testcase/controller/TestStepController.java`
Endpoints from §4.5.

---

### Phase 7: Global Config & Global Test Steps (Backend)

---

#### [NEW] `global_config/entity/GlobalEnvConfig.java`
#### [NEW] `global_config/repository/GlobalEnvConfigRepository.java`
#### [NEW] `global_config/dto/GlobalEnvConfigDto.java` / `CreateGlobalEnvConfigRequest.java`
#### [NEW] `global_config/service/GlobalEnvConfigService.java`
CRUD with secret masking.
#### [NEW] `global_config/controller/GlobalEnvConfigController.java`
Endpoints from §4.7.

---

#### [NEW] `global_step/entity/GlobalTestStep.java`
#### [NEW] `global_step/repository/GlobalTestStepRepository.java`
#### [NEW] `global_step/dto/GlobalTestStepDto.java` / `CreateGlobalTestStepRequest.java`
#### [NEW] `global_step/service/GlobalTestStepService.java`
CRUD + search by name/type.
#### [NEW] `global_step/controller/GlobalTestStepController.java`
Endpoints from §4.8.

---

### Phase 8: Execution Engine (Backend)

The core execution engine that runs test cases against environments.

---

#### [NEW] `execution/entity/Execution.java`
Execution JPA entity with status enum.

#### [NEW] `execution/entity/ExecutionStepLog.java`
ExecutionStepLog JPA entity.

#### [NEW] `execution/repository/ExecutionRepository.java` / `ExecutionStepLogRepository.java`

#### [NEW] `execution/dto/ExecutionDto.java` / `ExecutionStepLogDto.java` / `TriggerExecutionRequest.java` / `ExecutionStatsDto.java`

#### [NEW] `execution/engine/ExecutionEngine.java`
Core engine implementing the execution flow from §4.6:
- Variable resolution (merge global configs + environment variables)
- Sequential step processing with `{{var}}` interpolation
- HTTP request execution via `RestClient` / `WebClient`
- Assertion evaluation
- SET_VARIABLE extraction
- DELAY handling
- LOG capture
- Step-level result logging
- Pass/fail determination
- Error handling with abort-on-failure

#### [NEW] `execution/engine/StepExecutor.java`
Strategy interface for executing different step types.

#### [NEW] `execution/engine/executors/HttpRequestExecutor.java`
Makes actual HTTP calls using Spring's `RestClient`, captures response.

#### [NEW] `execution/engine/executors/AssertionExecutor.java`
Evaluates assertion conditions (EQUALS, CONTAINS, REGEX_MATCH, STATUS_CODE, etc.).

#### [NEW] `execution/engine/executors/DelayExecutor.java`
#### [NEW] `execution/engine/executors/SetVariableExecutor.java`
#### [NEW] `execution/engine/executors/LogExecutor.java`
#### [NEW] `execution/engine/executors/ScriptExecutor.java`
#### [NEW] `execution/engine/executors/ConditionalExecutor.java`
#### [NEW] `execution/engine/executors/LoopExecutor.java`
#### [NEW] `execution/engine/executors/DatabaseQueryExecutor.java`

#### [NEW] `execution/service/ExecutionService.java`
Trigger execution (async via `@Async`), cancel, re-run, list/filter, get details with step logs, SSE streaming.

#### [NEW] `execution/controller/ExecutionController.java`
All endpoints from §4.6 including SSE stream endpoint.

#### [NEW] `config/AsyncConfig.java`
`@EnableAsync` configuration with thread pool for execution engine.

---

### Phase 9: Frontend — Layout, Auth & Routing

Set up the frontend shell: theme, layout, authentication flow, and routing structure.

---

#### [NEW] `src/App.tsx`
Root component with React Router, QueryClientProvider, theme provider, Sonner toaster.

#### [NEW] `src/routes/index.tsx`
Route definitions for all pages with lazy loading, auth guards, role-based route protection.

#### [NEW] `src/components/layout/AppLayout.tsx`
Main layout: collapsible sidebar + top header + content area.

#### [NEW] `src/components/layout/Sidebar.tsx`
Navigation sidebar matching §6.2 structure with icons, collapsible sections, active state.

#### [NEW] `src/components/layout/Header.tsx`
Top header with breadcrumbs, user menu dropdown, theme toggle.

#### [NEW] `src/stores/auth-store.ts`
Zustand store for auth state: user, tokens, login/logout actions.

#### [NEW] `src/hooks/use-auth.ts`
Auth hook wrapping the store with convenience methods.

#### [NEW] `src/services/auth-service.ts`
API service for auth endpoints (login, register, refresh, logout).

#### [NEW] `src/pages/auth/LoginPage.tsx`
Login form with email/password, validation, error handling, redirect on success.

#### [NEW] `src/pages/auth/RegisterPage.tsx`
Registration form.

#### [NEW] `src/components/shared/ProtectedRoute.tsx`
Route guard that checks auth status and role.

#### [NEW] `src/types/auth.ts` / `src/types/api.ts`
TypeScript type definitions for auth DTOs and API response formats.

#### Theme / Design System Setup
- Configure shadcn/ui with dark mode primary theme
- Set up Tailwind CSS v4 with custom color palette (indigo/violet primary, cyan accent, amber warning, rose error)
- Import Inter font from Google Fonts
- Add Framer Motion page transition wrapper

---

### Phase 10: Frontend — Core CRUD Pages

Build the main CRUD pages for Applications, Environments, Test Cases, Users, Global Config, and Global Steps.

---

#### [NEW] `src/pages/dashboard/DashboardPage.tsx`
Dashboard with stat cards (total apps, test cases, executions, pass rate), recent executions table, quick action buttons.

#### [NEW] `src/pages/applications/ApplicationListPage.tsx`
Application list with card and table views, search, filter, create button.

#### [NEW] `src/pages/applications/ApplicationDetailPage.tsx`
Application detail with tabbed layout (Overview, Environments, Test Cases, Executions).

#### [NEW] `src/pages/applications/ApplicationFormDialog.tsx`
Create/edit application modal form.

#### [NEW] `src/pages/environments/EnvironmentListPage.tsx`
Environment list within the application detail tab.

#### [NEW] `src/pages/environments/EnvironmentDetailPage.tsx`
Environment detail with variable editor (key-value table, add/remove, secret toggle).

#### [NEW] `src/pages/testcases/TestCaseListPage.tsx`
Test case list with filters (name, tag, priority, status), actions (run, clone, export).

#### [NEW] `src/pages/testcases/TestCaseDetailPage.tsx`
Test case detail with read-only step list, metadata, run button.

#### [NEW] `src/pages/users/UserManagementPage.tsx`
Admin user management data table with role change, activate/deactivate actions.

#### [NEW] `src/pages/settings/ProfilePage.tsx`
User profile settings page.

#### [NEW] `src/pages/global-config/GlobalEnvConfigPage.tsx`
Global env config list with inline edit, secret masking.

#### [NEW] `src/pages/global-config/GlobalTestStepListPage.tsx`
Global test step list with cards.

#### [NEW] `src/pages/global-config/GlobalTestStepFormPage.tsx`
Create/edit global test step using the same step config panel from the designer.

#### Supporting Components
- `src/services/application-service.ts`, `environment-service.ts`, `testcase-service.ts`, `user-service.ts`, `global-config-service.ts`, `global-step-service.ts`
- `src/types/application.ts`, `environment.ts`, `testcase.ts`, `user.ts`, `global-config.ts`, `global-step.ts`
- `src/hooks/use-applications.ts`, `use-environments.ts`, etc. (TanStack Query hooks)
- `src/components/shared/DataTable.tsx` — Reusable data table wrapper
- `src/components/shared/ConfirmDialog.tsx` — Delete confirmation dialog
- `src/components/shared/EmptyState.tsx` — Illustrated empty state
- `src/components/shared/PageHeader.tsx` — Page header with title, breadcrumbs, actions

---

### Phase 11: Frontend — Workflow Designer

The visual workflow builder — the core feature of ORION.

---

#### [NEW] `src/pages/testcases/WorkflowDesignerPage.tsx`
Main designer page wrapping the canvas, toolbar, and config panel.

#### [NEW] `src/components/workflow/WorkflowCanvas.tsx`
React Flow canvas with custom node types, edge connections, zoom/pan controls.

#### [NEW] `src/components/workflow/StepNode.tsx`
Custom React Flow node component: step number, name, type icon (color-coded), config summary, status indicator.

#### [NEW] `src/components/workflow/StepToolbar.tsx`
Toolbar: Add Step, Insert Step, Validate, Save, Run buttons.

#### [NEW] `src/components/workflow/StepTypeSelector.tsx`
Modal to select step type with icons and descriptions for each type.

#### [NEW] `src/components/workflow/StepConfigPanel.tsx`
Side drawer that renders the appropriate configuration form based on step type. Sub-components:

- `HttpRequestConfigForm.tsx` — URL, method, headers, body, query params, timeout
- `AssertionConfigForm.tsx` — Source, JSONPath, operator, expected value
- `SetVariableConfigForm.tsx` — Variable name, source, JSONPath/header
- `DelayConfigForm.tsx` — Duration input
- `LogConfigForm.tsx` — Message, level
- `ConditionalConfigForm.tsx` — Condition, true/false step indices
- `LoopConfigForm.tsx` — Type (COUNT/FOR_EACH), count, data source
- `DatabaseQueryConfigForm.tsx` — Connection string, query, result variable
- `ScriptConfigForm.tsx` — Script editor

#### [NEW] `src/components/workflow/VariableAutocomplete.tsx`
Autocomplete that suggests available variables when user types `{{`. Sources: environment variables, global configs, extracted variables from previous steps.

#### [NEW] `src/components/workflow/GlobalStepPicker.tsx`
Modal to browse and select global test steps.

#### [NEW] `src/stores/workflow-store.ts`
Zustand store for workflow designer state: steps, selected step, dirty flag, undo/redo.

---

### Phase 12: Frontend — Execution UI

Execution history, detail view with real-time progress, and run dialog.

---

#### [NEW] `src/pages/executions/ExecutionListPage.tsx`
Global execution history with filters (status, date range, app, test case).

#### [NEW] `src/pages/executions/ExecutionDetailPage.tsx`
Execution detail: summary card (status, duration, pass/fail counts) + step-by-step result timeline. Each step expandable to show request/response payloads, errors. Real-time updates while execution is running (SSE or polling).

#### [NEW] `src/components/shared/RunTestDialog.tsx`
Modal triggered from test case pages: select environment → confirm → run. Shows live progress after triggering.

#### [NEW] `src/components/shared/ExecutionStatusBadge.tsx`
Color-coded status badge (QUEUED → yellow, RUNNING → blue pulse, PASSED → green, FAILED → red, ERROR → orange, CANCELLED → gray).

#### [NEW] `src/services/execution-service.ts`
API service for execution endpoints + SSE event source setup.

#### [NEW] `src/hooks/use-execution-stream.ts`
Hook that connects to SSE endpoint for real-time execution updates, falls back to polling.

---

## Verification Plan

### Automated Tests

**Backend**:
```bash
cd orion-backend
mvn test
```
- Unit tests for all services using Mockito
- Integration tests for controllers using `@SpringBootTest` + `MockMvc`
- Test the execution engine step-by-step with mock HTTP responses
- Validate JWT generation/validation
- Validate Flyway migrations run cleanly

**Frontend**:
```bash
cd orion-frontend
npm run build
```
- TypeScript compilation check (catches type errors)
- Build verification (ensures all imports resolve and code compiles)

### Manual Verification

1. **Auth flow**: Register → Login → Access protected pages → Refresh token → Logout
2. **Application CRUD**: Create, edit, list, soft-delete applications
3. **Environment CRUD**: Create environment with variables, clone, verify secret masking
4. **Test Case + Designer**: Create test case → open designer → add steps (HTTP, Assertion, SetVariable) → reorder → save
5. **Execution**: Run a test case against an environment → watch real-time progress → view results
6. **Global Configs**: Create global env config and global test step → use in a test case → verify resolution
7. **RBAC**: Test with ADMIN, TESTER, VIEWER roles — verify access restrictions
8. **UI/UX**: Dark mode, sidebar navigation, responsive layout, loading/empty states, toast notifications

---

## Implementation Sequence Summary

| Phase | Scope | Est. Files |
|-------|-------|-----------|
| 1 | Project Scaffolding & Infrastructure | ~15 |
| 2 | Database Schema & Migrations | ~11 |
| 3 | Common/Shared Backend Components | ~15 |
| 4 | Auth & User Management (Backend) | ~18 |
| 5 | Application & Environment Management (Backend) | ~14 |
| 6 | Test Case & Test Step Management (Backend) | ~14 |
| 7 | Global Config & Global Test Steps (Backend) | ~12 |
| 8 | Execution Engine (Backend) | ~20 |
| 9 | Frontend — Layout, Auth & Routing | ~18 |
| 10 | Frontend — Core CRUD Pages | ~30 |
| 11 | Frontend — Workflow Designer | ~16 |
| 12 | Frontend — Execution UI | ~10 |
| **Total** | | **~193 files** |
