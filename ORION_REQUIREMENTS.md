# ORION — Test Case Workflow Builder & Execution Platform

## 1. Project Overview

**ORION** is a full-stack web application for designing, managing, and executing test cases using a visual workflow builder. Users create "Applications" as top-level containers, define multiple "Environments" per application, design test cases as step-by-step workflows, and execute those test cases against any environment — all while tracking execution status, logs, and results in real time.

### 1.1 Core Value Proposition

- **Visual Test Design**: A drag-and-drop (or sequential step-builder) workflow designer that lets QA engineers compose test steps without writing code.
- **Multi-Environment Execution**: Run the same test case against dev, staging, production, or any custom environment with a single click.
- **Reusability via Globals**: Global environment configs and global test steps can be shared across all applications, reducing duplication.
- **Full Execution Tracking**: Every test run is tracked with status, timestamps, step-level logs, duration, and pass/fail verdicts.

---

## 2. Tech Stack

### 2.1 Backend

| Layer | Technology | Version |
|---|---|---|
| Framework | Spring Boot | 4.0.7 |
| Language | Java | 21 |
| Build Tool | Apache Maven | 3.9+ |
| Database | SQLite | Latest (via `sqlite-jdbc`) |
| ORM | Spring Data JPA + Hibernate | (bundled with Spring Boot 4.x) |
| Auth | Spring Security + JWT | (bundled with Spring Boot 4.x) |
| API Style | RESTful JSON APIs | — |
| Validation | Jakarta Bean Validation (`spring-boot-starter-validation`) | — |
| Migrations | Flyway (with SQLite support) | Latest compatible |
| Testing | JUnit 5 + Mockito + Spring Boot Test | — |

**Maven Coordinates (base package):**
```
groupId:    com.axon.orion
artifactId: orion-backend
packaging:  jar
```

**Recommended Additional Maven Dependencies:**
```xml
<!-- SQLite JDBC Driver -->
<dependency>
    <groupId>org.xerial</groupId>
    <artifactId>sqlite-jdbc</artifactId>
</dependency>

<!-- SQLite Hibernate Dialect (community) -->
<dependency>
    <groupId>org.hibernate.orm</groupId>
    <artifactId>hibernate-community-dialects</artifactId>
</dependency>

<!-- JWT for auth tokens -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>

<!-- Flyway for DB migrations -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- Lombok (optional but recommended) -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>

<!-- MapStruct for DTO mapping (optional) -->
<dependency>
    <groupId>org.mapstruct</groupId>
    <artifactId>mapstruct</artifactId>
    <version>1.6.3</version>
</dependency>
```

### 2.2 Frontend

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19.x (latest) |
| Build Tool | Vite | 6.x (latest) |
| Language | TypeScript | 5.x |
| UI Library | shadcn/ui | Latest |
| Styling | Tailwind CSS | 4.x |
| State Mgmt | Zustand or React Context | Latest |
| HTTP Client | Axios or TanStack Query | Latest |
| Routing | React Router | 7.x |
| Workflow UI | React Flow (for visual workflow builder) | Latest |
| Icons | Lucide React (ships with shadcn/ui) | Latest |
| Forms | React Hook Form + Zod validation | Latest |
| Notifications | Sonner (toast, ships with shadcn/ui) | Latest |

### 2.3 Project Structure (Monorepo)

```
orion/
├── orion-backend/               # Spring Boot Maven project
│   ├── pom.xml
│   └── src/
│       ├── main/
│       │   ├── java/com/axon/orion/
│       │   │   ├── OrionApplication.java
│       │   │   ├── config/          # Security, CORS, WebConfig
│       │   │   ├── auth/            # Auth controller, service, JWT util
│       │   │   ├── user/            # User entity, repo, service, controller
│       │   │   ├── application/     # Application entity, repo, service, controller
│       │   │   ├── environment/     # Environment entity, repo, service, controller
│       │   │   ├── testcase/        # TestCase + TestStep entities, repos, services, controllers
│       │   │   ├── execution/       # Execution entity, repo, service, controller, engine
│       │   │   ├── global_config/   # GlobalEnvConfig entity, repo, service, controller
│       │   │   ├── global_step/     # GlobalTestStep entity, repo, service, controller
│       │   │   ├── common/          # Base entity, DTOs, exceptions, utils
│       │   │   └── audit/           # Audit trail entity and listener
│       │   └── resources/
│       │       ├── application.yml
│       │       └── db/migration/    # Flyway SQL migration scripts
│       └── test/
├── orion-frontend/              # React + Vite project
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── components.json          # shadcn/ui config
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/
│       ├── components/
│       │   ├── ui/              # shadcn/ui primitives
│       │   ├── layout/          # Sidebar, Header, Footer
│       │   ├── workflow/        # Workflow builder components
│       │   └── shared/          # Reusable composed components
│       ├── pages/
│       │   ├── auth/
│       │   ├── dashboard/
│       │   ├── applications/
│       │   ├── environments/
│       │   ├── testcases/
│       │   ├── executions/
│       │   ├── global-config/
│       │   └── users/
│       ├── hooks/
│       ├── services/            # API service layer
│       ├── stores/              # Zustand stores
│       ├── types/               # TypeScript type definitions
│       └── lib/                 # Utility functions
└── ORION_REQUIREMENTS.md        # This file
```

---

## 3. Data Model (Entity Relationship)

### 3.1 ER Diagram

```
┌──────────────────┐
│      User        │
├──────────────────┤
│ id (PK)          │
│ username         │
│ email            │
│ passwordHash     │
│ fullName         │
│ role (ENUM)      │  ──── ADMIN | TESTER | VIEWER
│ isActive         │
│ createdAt        │
│ updatedAt        │
└──────┬───────────┘
       │ created_by (FK)
       ▼
┌──────────────────┐       ┌─────────────────────┐
│   Application    │       │  GlobalEnvConfig     │
├──────────────────┤       ├─────────────────────┤
│ id (PK)          │       │ id (PK)              │
│ name             │       │ configKey            │
│ description      │       │ configValue          │
│ baseUrl          │       │ description          │
│ isActive         │       │ isSecret             │
│ createdBy (FK)   │       │ createdBy (FK→User)  │
│ createdAt        │       │ createdAt            │
│ updatedAt        │       │ updatedAt            │
└──────┬───────────┘       └─────────────────────┘
       │
       │ 1:N
       ▼
┌──────────────────┐       ┌─────────────────────┐
│   Environment    │       │   GlobalTestStep     │
├──────────────────┤       ├─────────────────────┤
│ id (PK)          │       │ id (PK)              │
│ appId (FK→App)   │       │ name                 │
│ name             │       │ description          │
│ description      │       │ stepType (ENUM)      │
│ variables (JSON) │       │ actionType (ENUM)    │
│ isActive         │       │ config (JSON)        │
│ createdBy (FK)   │       │ createdBy (FK→User)  │
│ createdAt        │       │ createdAt            │
│ updatedAt        │       │ updatedAt            │
└──────────────────┘       └─────────────────────┘
       │
       │ (used in execution)
       ▼
┌──────────────────┐
│    TestCase       │
├──────────────────┤
│ id (PK)          │
│ appId (FK→App)   │
│ name             │
│ description      │
│ tags (JSON)      │
│ priority (ENUM)  │  ──── LOW | MEDIUM | HIGH | CRITICAL
│ status (ENUM)    │  ──── DRAFT | READY | DEPRECATED
│ createdBy (FK)   │
│ createdAt        │
│ updatedAt        │
└──────┬───────────┘
       │
       │ 1:N (ordered)
       ▼
┌──────────────────────┐
│     TestStep          │
├──────────────────────┤
│ id (PK)              │
│ testCaseId (FK)      │
│ sequenceOrder        │
│ name                 │
│ description          │
│ stepType (ENUM)      │  ──── See §3.2
│ actionType (ENUM)    │  ──── See §3.2
│ config (JSON)        │  ──── Step-specific config payload
│ expectedResult       │
│ isGlobalRef          │  ──── true if referencing a GlobalTestStep
│ globalStepId (FK)    │  ──── nullable, FK → GlobalTestStep
│ createdAt            │
│ updatedAt            │
└──────────────────────┘
       │
       │ (executed as part of)
       ▼
┌──────────────────────┐
│    Execution          │
├──────────────────────┤
│ id (PK)              │
│ testCaseId (FK)      │
│ environmentId (FK)   │
│ status (ENUM)        │  ──── QUEUED | RUNNING | PASSED | FAILED | ERROR | CANCELLED
│ triggeredBy (FK)     │
│ startedAt            │
│ completedAt          │
│ durationMs           │
│ totalSteps           │
│ passedSteps          │
│ failedSteps          │
│ errorMessage         │
│ createdAt            │
└──────┬───────────────┘
       │
       │ 1:N
       ▼
┌──────────────────────┐
│  ExecutionStepLog     │
├──────────────────────┤
│ id (PK)              │
│ executionId (FK)     │
│ testStepId (FK)      │
│ sequenceOrder        │
│ status (ENUM)        │  ──── PENDING | RUNNING | PASSED | FAILED | SKIPPED
│ inputPayload (JSON)  │
│ outputPayload (JSON) │
│ errorMessage         │
│ startedAt            │
│ completedAt          │
│ durationMs           │
└──────────────────────┘
```

### 3.2 Step Type & Action Type Enumerations

**StepType** — Categorizes the nature of the step:
| Value | Description |
|---|---|
| `HTTP_REQUEST` | Make an HTTP API call (GET, POST, PUT, DELETE, PATCH) |
| `ASSERTION` | Validate a response value against an expected result |
| `DELAY` | Wait/pause for a specified duration |
| `SET_VARIABLE` | Extract a value from a previous step's response and store it as a variable |
| `CONDITIONAL` | Branch logic — execute next steps based on a condition |
| `LOOP` | Repeat a set of steps N times or over a data set |
| `SCRIPT` | Execute a custom script/expression (e.g., JavaScript snippet) |
| `LOG` | Log a message or variable value to the execution log |
| `DATABASE_QUERY` | Run a SQL query against a configured database connection |
| `GLOBAL_REF` | Reference to a GlobalTestStep (inherits its config) |

**ActionType** — Sub-categorizes within a StepType (primarily for HTTP_REQUEST):
| Value | Applies To | Description |
|---|---|---|
| `GET` | HTTP_REQUEST | HTTP GET request |
| `POST` | HTTP_REQUEST | HTTP POST request |
| `PUT` | HTTP_REQUEST | HTTP PUT request |
| `DELETE` | HTTP_REQUEST | HTTP DELETE request |
| `PATCH` | HTTP_REQUEST | HTTP PATCH request |
| `EQUALS` | ASSERTION | Assert exact equality |
| `NOT_EQUALS` | ASSERTION | Assert inequality |
| `CONTAINS` | ASSERTION | Assert substring/element containment |
| `GREATER_THAN` | ASSERTION | Assert numeric greater-than |
| `LESS_THAN` | ASSERTION | Assert numeric less-than |
| `REGEX_MATCH` | ASSERTION | Assert regex pattern match |
| `STATUS_CODE` | ASSERTION | Assert HTTP status code |
| `JSON_PATH` | SET_VARIABLE | Extract value using JSONPath expression |
| `HEADER` | SET_VARIABLE | Extract value from response header |
| `EXECUTE` | SCRIPT | Execute inline script |
| `SELECT` | DATABASE_QUERY | Run a SELECT query |
| `NONE` | DELAY, LOG, LOOP, CONDITIONAL, GLOBAL_REF | No sub-action |

### 3.3 Step Config JSON Schema (by StepType)

Each `TestStep.config` field is a JSON object whose schema varies by `stepType`:

#### HTTP_REQUEST
```json
{
  "url": "{{baseUrl}}/api/users",          // supports variable interpolation
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{authToken}}"
  },
  "queryParams": {
    "page": "1",
    "limit": "{{pageSize}}"
  },
  "body": {
    "username": "{{testUser}}",
    "email": "test@example.com"
  },
  "bodyType": "JSON",                      // JSON | FORM | RAW | NONE
  "timeoutMs": 30000
}
```

#### ASSERTION
```json
{
  "source": "RESPONSE_BODY",              // RESPONSE_BODY | RESPONSE_HEADER | STATUS_CODE | VARIABLE
  "jsonPath": "$.data.id",                // JSONPath to extract value (if source is RESPONSE_BODY)
  "headerName": null,                     // header name (if source is RESPONSE_HEADER)
  "variableName": null,                   // variable name (if source is VARIABLE)
  "operator": "EQUALS",                   // matches ActionType
  "expectedValue": "123",
  "message": "User ID should be 123"      // custom assertion failure message
}
```

#### SET_VARIABLE
```json
{
  "variableName": "authToken",
  "source": "RESPONSE_BODY",
  "jsonPath": "$.data.token",
  "headerName": null,
  "scope": "EXECUTION"                    // EXECUTION (available for remaining steps) | STEP (only this step)
}
```

#### DELAY
```json
{
  "durationMs": 2000
}
```

#### LOG
```json
{
  "message": "Current token: {{authToken}}",
  "level": "INFO"                          // INFO | WARN | DEBUG
}
```

#### CONDITIONAL
```json
{
  "condition": "{{statusCode}} == 200",
  "onTrueStepIndex": 5,                   // jump to step index if true
  "onFalseStepIndex": 7                   // jump to step index if false
}
```

#### LOOP
```json
{
  "type": "COUNT",                         // COUNT | FOR_EACH
  "count": 5,
  "dataSource": null,                      // JSONPath to array for FOR_EACH
  "iteratorVariable": "item",
  "steps": [3, 4, 5]                       // step indices to repeat
}
```

#### DATABASE_QUERY
```json
{
  "connectionString": "{{dbConnection}}",
  "query": "SELECT count(*) FROM users WHERE active = true",
  "resultVariable": "userCount"
}
```

---

## 4. Functional Requirements (Detailed)

### 4.1 Module 1: User Management

**Description**: Complete user lifecycle management with role-based access control (RBAC).

**Roles**:
| Role | Permissions |
|---|---|
| `ADMIN` | Full access: manage users, apps, global configs, global steps, all CRUD, execute tests |
| `TESTER` | Create/edit apps, environments, test cases, execute tests, view results. Cannot manage users or global configs/steps |
| `VIEWER` | Read-only access to everything. Cannot create, edit, delete, or execute |

**Features**:
- **Registration**: New users register with username, email, password, full name. Default role: `TESTER`. Admin can change roles.
- **Login / Logout**: JWT-based authentication. Access token (short-lived, ~15 min) + refresh token (long-lived, ~7 days).
- **Profile Management**: Users can update their own profile (name, email, password).
- **User CRUD (Admin only)**: List all users, activate/deactivate users, change user roles, delete users.
- **Password Security**: Passwords hashed with BCrypt. Minimum 8 characters.

**API Endpoints**:
```
POST   /api/auth/register          # Register a new user
POST   /api/auth/login             # Login, returns JWT tokens
POST   /api/auth/refresh           # Refresh access token
POST   /api/auth/logout            # Invalidate refresh token

GET    /api/users                  # List all users (ADMIN)
GET    /api/users/{id}             # Get user by ID (ADMIN or self)
PUT    /api/users/{id}             # Update user (ADMIN or self)
DELETE /api/users/{id}             # Soft-delete user (ADMIN)
PATCH  /api/users/{id}/role        # Change user role (ADMIN)
PATCH  /api/users/{id}/status      # Activate/deactivate (ADMIN)
GET    /api/users/me               # Get current user profile
PUT    /api/users/me               # Update own profile
PUT    /api/users/me/password      # Change own password
```

**Frontend Pages**:
- `/login` — Login page
- `/register` — Registration page
- `/settings/profile` — User profile settings
- `/admin/users` — User management table (Admin only)

---

### 4.2 Module 2: Application Management

**Description**: Applications are the top-level organizational unit. Everything (environments, test cases, executions) belongs to an application.

**Features**:
- CRUD operations for applications.
- Each application has: name (unique), description, optional base URL, active/inactive status.
- Dashboard view showing application count, test case count, recent executions per app.
- Soft-delete support (mark as inactive rather than hard delete).
- Search and filter applications by name, status.

**API Endpoints**:
```
POST   /api/applications                    # Create application
GET    /api/applications                    # List all applications (with pagination, search, filter)
GET    /api/applications/{id}               # Get application details (with summary counts)
PUT    /api/applications/{id}               # Update application
DELETE /api/applications/{id}               # Soft-delete application
GET    /api/applications/{id}/summary       # Get stats: env count, testcase count, execution count
```

**Frontend Pages**:
- `/applications` — Application list with cards/table view
- `/applications/new` — Create new application form
- `/applications/{id}` — Application detail view (tabs: Overview, Environments, Test Cases, Executions)
- `/applications/{id}/edit` — Edit application

---

### 4.3 Module 3: Environment Management

**Description**: Each application can have multiple environments (e.g., Dev, Staging, Production). Environments hold key-value variable pairs used during test execution.

**Features**:
- CRUD for environments scoped to an application.
- Each environment stores a set of key-value variables as JSON (e.g., `baseUrl`, `apiKey`, `authToken`).
- Variable values support **secret masking** (marked as `isSecret`; values are not returned in GET responses, only `***`).
- Clone an environment (duplicate with all variables to create a new one quickly).
- Variables support interpolation syntax: `{{variableName}}` — resolved at execution time.
- **Global env configs** (§4.6) are merged with app-environment variables at execution time. App-level variables override globals if keys collide.

**API Endpoints**:
```
POST   /api/applications/{appId}/environments              # Create environment
GET    /api/applications/{appId}/environments              # List environments for app
GET    /api/applications/{appId}/environments/{envId}      # Get environment details
PUT    /api/applications/{appId}/environments/{envId}      # Update environment
DELETE /api/applications/{appId}/environments/{envId}      # Delete environment
POST   /api/applications/{appId}/environments/{envId}/clone  # Clone environment
GET    /api/applications/{appId}/environments/{envId}/variables  # Get resolved variables (secrets masked)
```

**Environment Variable JSON Structure**:
```json
{
  "variables": [
    { "key": "baseUrl", "value": "https://api-dev.example.com", "isSecret": false },
    { "key": "apiKey", "value": "sk-xxxx-yyyy", "isSecret": true },
    { "key": "authToken", "value": "", "isSecret": true, "description": "Set at runtime" }
  ]
}
```

**Frontend Pages**:
- `/applications/{id}/environments` — Environment list (tab within application detail)
- `/applications/{id}/environments/new` — Create environment form
- `/applications/{id}/environments/{envId}` — Environment detail with variable editor
- `/applications/{id}/environments/{envId}/edit` — Edit environment

---

### 4.4 Module 4: Test Case Management

**Description**: Test cases belong to an application. Each test case is a named, ordered collection of test steps. Test cases can be run against any environment of their parent application.

**Features**:
- CRUD for test cases scoped to an application.
- Each test case has: name, description, tags (for filtering/grouping), priority level, status (Draft → Ready → Deprecated).
- List/filter test cases by name, tag, priority, status.
- Duplicate (clone) a test case.
- Import/Export test cases as JSON.
- Version tracking — when a test case is modified, a new version is logged (optional enhancement).

**API Endpoints**:
```
POST   /api/applications/{appId}/testcases                   # Create test case
GET    /api/applications/{appId}/testcases                   # List test cases (paginated, filterable)
GET    /api/applications/{appId}/testcases/{tcId}            # Get test case with all steps
PUT    /api/applications/{appId}/testcases/{tcId}            # Update test case metadata
DELETE /api/applications/{appId}/testcases/{tcId}            # Delete test case
POST   /api/applications/{appId}/testcases/{tcId}/clone      # Clone test case
POST   /api/applications/{appId}/testcases/{tcId}/export     # Export as JSON
POST   /api/applications/{appId}/testcases/import            # Import from JSON
```

**Frontend Pages**:
- `/applications/{id}/testcases` — Test case list (tab within application detail)
- `/applications/{id}/testcases/new` — Create test case (opens designer)
- `/applications/{id}/testcases/{tcId}` — Test case detail view (read-only step list + metadata)
- `/applications/{id}/testcases/{tcId}/designer` — **Workflow Designer** (§4.5)

---

### 4.5 Module 5: Test Case Designer (Workflow Builder)

**Description**: The core feature of ORION. A visual workflow builder where users compose test steps in sequence, configure each step, and save the complete workflow as a test case.

**UI Concept**: A visual canvas (built with **React Flow** or a custom sequential builder) showing steps as connected nodes in a flowchart. Users can:

1. **Add a step**: Click "+ Add Step" to append a new step. Choose step type from a dropdown/modal.
2. **Insert a step**: Insert a step between two existing steps.
3. **Reorder steps**: Drag-and-drop to reorder steps.
4. **Delete a step**: Remove a step from the workflow.
5. **Configure a step**: Click a step node to open a side panel/drawer with the step's configuration form (varies by step type — see §3.3).
6. **Reference a Global Step**: When adding a step, user can choose "Use Global Step" and pick from the list of GlobalTestSteps. The step inherits the global step's config but can override certain values.
7. **Variable interpolation preview**: As users type `{{variableName}}`, the designer shows available variables (from the selected environment, global configs, and previously extracted variables).
8. **Auto-save draft**: The designer auto-saves the current state as a draft.
9. **Save & Validate**: Save the test case. Run basic validation (e.g., no empty HTTP URLs, assertion has expected value, etc.).

**Step Node Visual Design**:
Each node in the workflow displays:
- Step number (sequence order)
- Step name
- Step type icon (color-coded by type)
- Brief config summary (e.g., "POST /api/users" for HTTP_REQUEST)
- Status indicator (for during execution playback: pending → running → pass/fail)

**API Endpoints (Test Steps)**:
```
POST   /api/testcases/{tcId}/steps                      # Add step to test case
GET    /api/testcases/{tcId}/steps                      # Get all steps (ordered)
GET    /api/testcases/{tcId}/steps/{stepId}             # Get step detail
PUT    /api/testcases/{tcId}/steps/{stepId}             # Update step
DELETE /api/testcases/{tcId}/steps/{stepId}             # Delete step
PUT    /api/testcases/{tcId}/steps/reorder              # Reorder steps (accepts ordered list of step IDs)
POST   /api/testcases/{tcId}/steps/bulk                 # Bulk save all steps (used by designer auto-save)
```

**Frontend Components**:
- `WorkflowCanvas` — The main canvas area using React Flow for visual layout
- `StepNode` — Custom React Flow node component for each step
- `StepConfigPanel` — Side drawer/panel that renders the appropriate config form based on step type
- `StepTypeSelector` — Modal/dropdown to select step type when adding a new step
- `VariableAutocomplete` — Autocomplete component that suggests variables when user types `{{`
- `GlobalStepPicker` — Modal to browse and select from available global test steps
- `StepToolbar` — Toolbar with actions: Add Step, Validate, Save, Run

---

### 4.6 Module 6: Execution Management

**Description**: When a user runs a test case against a specific environment, an Execution record is created. The system processes each step sequentially, resolving variables, making HTTP calls, evaluating assertions, and logging results per step.

**Execution Flow**:
```
1. User selects a test case and an environment → clicks "Run"
2. System creates an Execution record (status: QUEUED)
3. System resolves all variables:
   a. Load GlobalEnvConfig variables
   b. Load Environment variables (override globals on key collision)
   c. Merge into a variable context map
4. Status → RUNNING; startedAt = now
5. For each TestStep in sequence order:
   a. Create ExecutionStepLog (status: RUNNING)
   b. Resolve variable interpolation in step config (replace {{var}} with values)
   c. Execute the step action (HTTP call, assertion check, delay, etc.)
   d. Capture response/output
   e. If step type is SET_VARIABLE, add extracted value to variable context
   f. Evaluate pass/fail
   g. Update ExecutionStepLog (status: PASSED | FAILED, output, duration)
   h. If step FAILED and test case is not configured to continue-on-failure → abort remaining steps
6. After all steps complete (or abort):
   a. Calculate summary: totalSteps, passedSteps, failedSteps
   b. Set Execution status: PASSED (all steps passed) | FAILED (any step failed) | ERROR (unexpected error)
   c. Set completedAt, durationMs
7. Emit real-time status updates via SSE (Server-Sent Events) or polling
```

**Features**:
- **Execution History**: View all past executions for a test case or application, with filters (status, date range, triggered by).
- **Execution Detail**: View step-by-step results with expandable logs showing request/response payloads.
- **Re-run**: Re-run a past execution (same test case + environment).
- **Cancel**: Cancel a running execution.
- **Real-time Updates**: While an execution is running, the UI shows live step progress (via SSE or polling every 2 seconds).
- **Execution Summary Dashboard**: Charts showing pass/fail rates over time, average duration, most-failing test cases.

**API Endpoints**:
```
POST   /api/executions                                   # Trigger execution (body: {testCaseId, environmentId})
GET    /api/executions                                   # List all executions (paginated, filterable)
GET    /api/executions/{execId}                          # Get execution detail with step logs
GET    /api/executions/{execId}/logs                     # Get step-by-step logs
GET    /api/executions/{execId}/stream                   # SSE endpoint for real-time updates
POST   /api/executions/{execId}/cancel                   # Cancel running execution
POST   /api/executions/{execId}/rerun                    # Re-run execution

GET    /api/applications/{appId}/executions              # List executions for an application
GET    /api/testcases/{tcId}/executions                  # List executions for a test case

GET    /api/dashboard/execution-stats                    # Aggregated execution statistics
```

**Frontend Pages**:
- `/executions` — Global execution history list
- `/executions/{execId}` — Execution detail page with step-by-step results
- `/applications/{id}/executions` — Application-scoped execution history
- Run dialog/modal — Triggered from test case page, select environment → run

---

### 4.7 Module 7: Global Environment Config

**Description**: Admin-managed key-value configurations that are available across ALL applications. These are merged into the variable context when any test case is executed. App-level environment variables override global configs when keys conflict.

**Use Cases**:
- Shared API keys (e.g., a common auth service token)
- Common base URLs (e.g., shared microservices)
- Organization-wide test user credentials

**Features**:
- CRUD for global environment config entries (Admin only).
- Each entry: key, value, description, isSecret flag.
- Secret values are masked in API responses.
- Search/filter by key name.

**API Endpoints**:
```
POST   /api/global/env-configs                          # Create global config (ADMIN)
GET    /api/global/env-configs                          # List all global configs
GET    /api/global/env-configs/{id}                     # Get global config detail
PUT    /api/global/env-configs/{id}                     # Update global config (ADMIN)
DELETE /api/global/env-configs/{id}                     # Delete global config (ADMIN)
```

**Frontend Pages**:
- `/global/env-configs` — Global config list table with inline edit
- `/global/env-configs/new` — Create new global config

---

### 4.8 Module 8: Global Test Steps

**Description**: Admin-managed reusable test steps that can be referenced from any test case in any application. When a test case step references a global step, it inherits the global step's configuration.

**Use Cases**:
- A standard "Login" step that authenticates and extracts a token — used in most test cases.
- A "Health Check" step that pings a common endpoint.
- A "Cleanup" step that resets test data.

**Features**:
- CRUD for global test steps (Admin only).
- Each global step has: name, description, stepType, actionType, config (same JSON schema as regular TestStep config — see §3.3).
- When referenced in a test case, the test step stores `isGlobalRef = true` and `globalStepId = <id>`. At execution time, the system loads the global step's config and merges/overrides with any local config.
- Search/filter global steps by name, step type.

**API Endpoints**:
```
POST   /api/global/test-steps                            # Create global step (ADMIN)
GET    /api/global/test-steps                            # List all global steps
GET    /api/global/test-steps/{id}                       # Get global step detail
PUT    /api/global/test-steps/{id}                       # Update global step (ADMIN)
DELETE /api/global/test-steps/{id}                       # Delete global step (ADMIN)
```

**Frontend Pages**:
- `/global/test-steps` — Global step list with cards showing type, name, description
- `/global/test-steps/new` — Create new global step (uses the same StepConfigPanel from the designer)
- `/global/test-steps/{id}` — View/edit global step

---

## 5. Cross-Cutting Concerns

### 5.1 Authentication & Authorization

- **JWT-based** stateless authentication.
- Access token: Short-lived (15 minutes), included in `Authorization: Bearer <token>` header.
- Refresh token: Long-lived (7 days), stored in HTTP-only cookie or sent in body.
- Spring Security filters validate JWT on every request.
- Role-based endpoint access using `@PreAuthorize` annotations.
- CORS configured to allow frontend origin.

### 5.2 Error Handling

Standardized error response format:
```json
{
  "timestamp": "2026-07-03T18:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Application name is required",
  "path": "/api/applications",
  "details": [
    { "field": "name", "message": "must not be blank" }
  ]
}
```
- Global exception handler using `@RestControllerAdvice`.
- Custom exceptions: `ResourceNotFoundException`, `DuplicateResourceException`, `UnauthorizedException`, `ForbiddenException`, `ExecutionException`.

### 5.3 Pagination & Sorting

All list endpoints support:
```
GET /api/applications?page=0&size=20&sort=name,asc&search=myapp
```
Response format:
```json
{
  "content": [...],
  "page": 0,
  "size": 20,
  "totalElements": 45,
  "totalPages": 3,
  "last": false
}
```

### 5.4 Audit Trail

- Every create/update/delete operation logs: who, what, when, previous value (for updates).
- Stored in an `audit_log` table.
- Viewable by Admins.

### 5.5 Validation

- Backend: Jakarta Bean Validation annotations (`@NotBlank`, `@Email`, `@Size`, etc.) on DTOs.
- Frontend: Zod schemas mirroring backend validation rules, used with React Hook Form.

### 5.6 Database Configuration (SQLite)

**application.yml**:
```yaml
spring:
  datasource:
    url: jdbc:sqlite:./orion.db
    driver-class-name: org.sqlite.JDBC
  jpa:
    database-platform: org.hibernate.community.dialect.SQLiteDialect
    hibernate:
      ddl-auto: validate   # Use Flyway for migrations
    show-sql: false
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true

server:
  port: 8080

jwt:
  secret: ${JWT_SECRET:orion-default-secret-change-in-production-minimum-256-bits-long-key}
  access-token-expiration: 900000      # 15 minutes in ms
  refresh-token-expiration: 604800000  # 7 days in ms

cors:
  allowed-origins: http://localhost:5173
```

---

## 6. UI/UX Design Specifications

### 6.1 Theme & Design System

- **Color Scheme**: Dark mode primary with light mode toggle. Use shadcn/ui's built-in theme system.
- **Primary color**: Indigo/Violet gradient (`hsl(250, 80%, 60%)` range)
- **Accent**: Cyan/Teal for success states, Amber for warnings, Rose for errors
- **Typography**: Inter font family (clean, modern)
- **Layout**: Sidebar navigation (collapsible) + top header bar + main content area
- **Border radius**: Rounded (`0.5rem` default, as per shadcn/ui defaults)
- **Animations**: Framer Motion for page transitions, step additions in the workflow builder

### 6.2 Navigation Structure (Sidebar)

```
📊 Dashboard
📦 Applications
   └── (dynamic: selected app)
       ├── Overview
       ├── Environments
       ├── Test Cases
       └── Executions
🔬 Executions (Global)
🌐 Global Config
   ├── Environment Variables
   └── Test Steps
👥 Users (Admin only)
⚙️ Settings
   └── Profile
```

### 6.3 Key UI Interactions

| Interaction | Implementation |
|---|---|
| Create new entities | Modal dialogs (shadcn/ui Dialog + Form) |
| Delete confirmation | Alert dialog with entity name confirmation |
| Loading states | Skeleton loaders (shadcn/ui Skeleton) |
| Empty states | Illustrated empty state with CTA button |
| Notifications | Toast notifications via Sonner |
| Data tables | shadcn/ui DataTable with sorting, filtering, pagination |
| Step config forms | Dynamic forms rendered based on step type |
| Workflow canvas | React Flow with custom node components |
| Execution progress | Real-time step status updates with progress bar |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | API responses < 500ms for CRUD operations; execution engine handles steps sequentially with no artificial delays beyond configured DELAY steps |
| **Security** | Passwords hashed with BCrypt (strength 12); JWT tokens signed with HS512; secrets stored encrypted or at minimum masked in API responses; CORS restricted to frontend origin |
| **Scalability** | SQLite is suitable for single-instance deployment; architecture should allow future migration to PostgreSQL by changing only DataSource config + dialect |
| **Reliability** | Execution engine handles HTTP timeouts gracefully; failed steps are logged with full error details; execution state is persisted (can survive server restart for queued executions) |
| **Usability** | Responsive design (minimum 1024px width); keyboard navigation support; consistent loading and error states; informative validation messages |
| **Maintainability** | Clean layered architecture (Controller → Service → Repository); DTOs separate from entities; consistent naming conventions; comprehensive API documentation |

---

## 8. Build & Run Instructions

### 8.1 Backend

```bash
cd orion-backend
mvn clean install
mvn spring-boot:run
```
Backend runs on `http://localhost:8080`

### 8.2 Frontend

```bash
cd orion-frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173` (Vite default)

### 8.3 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | (generated) | Secret key for JWT signing (min 256-bit) |
| `SERVER_PORT` | `8080` | Backend server port |
| `VITE_API_BASE_URL` | `http://localhost:8080/api` | Frontend API base URL |

---

## 9. Seed Data

On first run, the system should seed the following:

1. **Default Admin User**:
   - Username: `admin`
   - Email: `admin@orion.local`
   - Password: `Admin@123`
   - Role: `ADMIN`

2. **Sample Application** (optional, for demo):
   - Name: "Sample API"
   - Description: "Sample application for demonstration"
   - Two environments: "Development" and "Staging" with sample variables
   - One sample test case with 3 steps (Login → Get User → Assert Status)

---

## 10. Future Enhancements (Out of Scope for V1)

These are noted for architectural awareness but NOT to be implemented in the first version:

- [ ] Parallel step execution (branching workflows)
- [ ] Scheduled/cron-based test execution
- [ ] Test suite grouping (group multiple test cases into a suite for batch execution)
- [ ] Webhooks / notifications (Slack, email) on execution completion
- [ ] File upload/download step type
- [ ] WebSocket step type for testing WebSocket APIs
- [ ] Multi-tenant support (organization-level isolation)
- [ ] gRPC / GraphQL step types
- [ ] CI/CD integration (trigger executions from Jenkins/GitHub Actions)
- [ ] Reporting & analytics dashboard with charts
- [ ] Test data generator / faker integration
- [ ] Role-based field-level permissions

---

## 11. Glossary

| Term | Definition |
|---|---|
| **Application** | Top-level container representing a software application/service being tested |
| **Environment** | A named set of variables (e.g., URLs, API keys) representing a deployment target |
| **Test Case** | A named, ordered collection of test steps that together validate a workflow or scenario |
| **Test Step** | A single action within a test case (e.g., make an HTTP request, assert a value) |
| **Execution** | A single run of a test case against a specific environment, producing step-by-step results |
| **Global Env Config** | Key-value pairs available across all applications during test execution |
| **Global Test Step** | A reusable step template available across all applications |
| **Variable Interpolation** | Replacing `{{variableName}}` placeholders with actual values at execution time |
| **Workflow Builder** | The visual UI for composing test steps into a test case |

---

*This document serves as the complete functional and technical specification for the ORION application. Any AI coding assistant should be able to use this document to generate the full application code for both backend and frontend.*
