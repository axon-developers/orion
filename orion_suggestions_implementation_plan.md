# Orion Suggestions Implementation Plan

This document outlines the step-by-step implementation plan for the features and changes suggested in `orion_improvement_suggestions.md`. The plan is divided into five phases, organized from structural backend foundation and security to advanced UI flow and enterprise integrations.

---

## Phase 1: Database & Security Foundations (Backend)

In this phase, we establish production readiness, data security at rest, and execution database resource management.

### 1.1 Multi-Profile Setup & Production Database Support
*   **Goal:** Allow Orion to run against PostgreSQL or MySQL in production, leaving SQLite for local development.
*   **Actions:**
    1.  Create `application-dev.yml` and configure it to use SQLite (`jdbc:sqlite:orion.db`).
    2.  Create `application-prod.yml` and configure it to run against PostgreSQL/MySQL using environment variables for credentials.
    3.  Configure `application.yml` to set `spring.profiles.active` dynamically (defaults to `dev`).
    4.  Verify that Flyway migration scripts run successfully on both SQLite and PostgreSQL.

### 1.2 AES-256 Secrets Encryption at Rest
*   **Goal:** Secure database passwords, credentials, and client certificates in the database.
*   **Actions:**
    1.  Create an `EncryptionService` in `com.axon.orion.common.service` using AES-256 (GCM mode). Set the master key to be loaded from an environment variable (`ORION_MASTER_KEY`).
    2.  Update `EnvironmentService` and DB repositories to encrypt sensitive connection metadata before saving to the DB.
    3.  Modify database execution logic so values are only decrypted dynamically during runtime step execution. Ensure decrypted secrets are never returned in frontend API payloads.

### 1.3 Execution-Scoped Connection Pool
*   **Goal:** Prevent connection thrashing by reusing a JDBC connection across multiple database query steps in a single execution.
*   **Actions:**
    1.  Update `ExecutionConnectionPool.java` to track and cache open connections mapped to the active `executionId`.
    2.  Modify the `DatabaseQueryExecutor` and `DbTableViewExecutor` to fetch a connection from `ExecutionConnectionPool` instead of instantiating a new one per query.
    3.  Modify `ExecutionEngine.java`'s `finally` block to call `connectionPool.closeConnections(executionId)` to close all cached connections when an execution finishes.

### 1.4 Security Auditing Expansion
*   **Goal:** Expand audit logging to trace sensitive operations.
*   **Actions:**
    1.  Create a Flyway migration script to add more granular fields to `audit_logs` (e.g., target entity, change diff, IP address).
    2.  Create a custom `@Auditable` annotation and Spring AOP Aspect to automatically intercept and log user role modifications, database connection creations, and keystore configurations.

---

## Phase 2: Flow-Control & Scripting Engine (Backend Core)

This phase focuses on replacing execution stubs with fully functional script, loop, and conditional execution runners.

### 2.1 Sandboxed Custom Script Executor (`SCRIPT`)
*   **Goal:** Allow users to write and execute JavaScript snippets that manipulate runtime execution variables.
*   **Actions:**
    1.  Add GraalVM polyglot dependencies to the backend `pom.xml`:
        ```xml
        <dependency>
            <groupId>org.graalvm.polyglot</groupId>
            <artifactId>polyglot</artifactId>
            <version>23.1.2</version>
        </dependency>
        <dependency>
            <groupId>org.graalvm.js</groupId>
            <artifactId>js</artifactId>
            <version>23.1.2</version>
            <scope>runtime</scope>
        </dependency>
        ```
    2.  Refactor `ScriptExecutor.java` to launch a secure, sandboxed polyglot `Context`.
    3.  Inject execution variables and a helper map (e.g., `setVariable(key, val)`) into the context globals before script execution.
    4.  Execute the custom JS block and map outputs back into the runtime variable context.

### 2.2 Branching Flow Executor (`CONDITIONAL`)
*   **Goal:** Conditionally execute subsequent steps based on a logical statement.
*   **Actions:**
    1.  Implement a dynamic boolean expression parser in `ConditionalExecutor.java` (using Spring Expression Language or GraalVM evaluation).
    2.  If the expression evaluates to `false`, return a `StepResult` with instruction to jump execution order to the end of the conditional block.
    3.  Refactor `ExecutionEngine.java` to check the `nextStepSequenceOrder` returned by the step result and jump sequence indices correctly.

### 2.3 Loop Iteration Executor (`LOOP`)
*   **Goal:** Iterate child step sequences multiple times or over arrays.
*   **Actions:**
    1.  Refactor `LoopExecutor.java` to support `COUNT` and `FOR_EACH` types.
    2.  Update the loop execution sequence. The loop executor should dynamically spin up sub-step executions iteratively, matching the sequence order of items inside the loop.
    3.  Log loop iterations dynamically under `ExecutionStepLog` with clean sequence identifiers (e.g., `Step 2 [Iteration 1]`).

---

## Phase 3: Frontend Refactoring & Type Safety (Frontend Core)

This phase addresses the frontend `config: any` type safety issue, dynamic panel rendering, and form validation.

### 3.1 Discriminated Union Types for Steps Config
*   **Goal:** Introduce strict TypeScript type structures to ensure editor stability.
*   **Actions:**
    1.  Modify `src/types/api.ts` to replace `config: any` with a type union of configurations:
        ```typescript
        export type StepConfig = 
            | HttpRequestConfig 
            | DatabaseQueryConfig 
            | BrowserAutomationConfig 
            | ...;
        ```
    2.  Apply these explicit types to Zustand's workflow stores and query hooks.

### 3.2 Dynamic Config Component Registry
*   **Goal:** Replace the monolithic `switch-case` in `StepConfigPanel.tsx` with a component registry map.
*   **Actions:**
    1.  Create a configuration registry map inside `StepConfigPanel.tsx`:
        ```typescript
        const configRegistry: Record<string, React.FC<StepConfigProps>> = {
            HTTP_REQUEST: HttpRequestConfig,
            DATABASE_QUERY: DatabaseQueryConfig,
            // ...
        };
        ```
    2.  Render components dynamically by index-resolving keys:
        ```tsx
        const ConfigComponent = configRegistry[step.stepType];
        return ConfigComponent ? <ConfigComponent step={step} ... /> : <DefaultConfig />;
        ```

### 3.3 Zod Schema Validation
*   **Goal:** Ensure inputs (URLs, timeouts, SQL queries) are validated before submittal.
*   **Actions:**
    1.  Install `react-hook-form` and `@hookform/resolvers/zod` in `orion-frontend`.
    2.  Define separate validation schemas using `zod` for each step configuration component.
    3.  Wrap config inputs in a standard `<Form>` element and render inline validation errors when fields are empty or format checks fail.

---

## Phase 4: Advanced UI & Interactive Flow Canvas (Frontend UI)

In this phase, we move beyond simple linear tables to a real node diagram workflow designer.

### 4.1 React Flow Designer Canvas
*   **Goal:** Evolve the step builder into a visual node canvas.
*   **Actions:**
    1.  Install `@xyflow/react` (formerly React Flow) in `orion-frontend`.
    2.  Refactor `WorkflowCanvas.tsx` to mount a React Flow workspace.
    3.  Design custom nodes (`StepNode.tsx`) mapping to each step type, complete with handle targets for connection routes.
    4.  Update Zustands store to manage both step sequences and coordinate positions (`x`, `y`) for nodes.

### 4.2 Real-time Visual Run Progress Animations
*   **Goal:** Animate step progress on the canvas as tests execute.
*   **Actions:**
    1.  Listen to the Server-Sent Events stream from the canvas view.
    2.  Update step node status classes dynamically (e.g., apply a pulsing yellow border for `RUNNING`, a green border for `PASSED`, and red for `FAILED`).
    3.  Add micro-animations (checkmarks, warnings, spinners) inside individual nodes.

---

## Phase 5: Enterprise Integrations & Utilities

This phase focuses on integrations, scheduled runs, and importing standard collections.

### 5.1 One-Click Local Setup (Docker Compose)
*   **Goal:** Support quick local development environments.
*   **Actions:**
    1.  Create a Dockerfile in `orion-backend` compiling the jar file.
    2.  Create a multi-stage Dockerfile in `orion-frontend` compiling assets and hosting via Nginx.
    3.  Write `docker-compose.yml` linking the backend, frontend, and a PostgreSQL service.

### 5.2 Postman & Swagger OpenAPI Imports
*   **Goal:** Bootstrap test steps by importing collections.
*   **Actions:**
    1.  Add endpoints in `TestCaseController.java` to parse uploaded JSON schemas (Postman Collections or Swagger definitions).
    2.  Convert API requests from the schema files directly into sequential `HTTP_REQUEST` steps inside target test cases.
    3.  Add an "Import" button to the visual builder interface.

### 5.3 Scheduled Test Runs & Cron Engine
*   **Goal:** Execute test cases on a schedule.
*   **Actions:**
    1.  Create `V17__create_scheduled_executions.sql` to save scheduling configurations.
    2.  Build a backend scheduling orchestrator using Spring's `@Scheduled` annotation combined with Quartz/Db Scheduler to run cron triggers.
    3.  Create a "Schedules" configuration tab in the frontend settings view.

### 5.4 Third-Party Webhooks & Notifications
*   **Goal:** Dispatch alerts on failures or completions.
*   **Actions:**
    1.  Implement a webhook service that issues POST requests on completion.
    2.  Provide templated integrations for Slack and MS Teams payloads.
    3.  Allow users to enable/disable alerts for individual test cases.
