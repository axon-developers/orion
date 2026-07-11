# Admin Settings Panel — Requirements & Implementation Plan

> **Goal**: Build a fully configurable, multi-screen Admin Settings Panel that allows administrators to control ORION's behaviour across both frontend and backend — including settings that require a system restart to take effect.

---

## Current State Analysis

Today, ORION's system behaviour is controlled by **hard-coded values** scattered across config files and source code. There is no runtime UI to change them:

| Setting | Current Location | Editable at Runtime? |
|---------|-----------------|---------------------|
| JWT access token expiry (15 min) | `application.yml` → `jwt.access-token-expiration` | ❌ Requires restart |
| JWT refresh token expiry (7 days) | `application.yml` → `jwt.refresh-token-expiration` | ❌ Requires restart |
| CORS allowed origins | `application.yml` → `cors.allowed-origins` | ❌ Requires restart |
| SMTP host/port/auth | `application.yml` → `spring.mail.*` | ❌ Requires restart |
| Email sender address | `application.yml` → `orion.mail.from` | ❌ Requires restart |
| Thread pool size (execution engine) | `AsyncConfig.java` → corePoolSize=1, maxPoolSize=1 | ❌ Requires restart |
| Thread pool queue capacity | `AsyncConfig.java` → queueCapacity=1000 | ❌ Requires restart |
| BCrypt password strength rounds | `SecurityConfig.java` → `BCryptPasswordEncoder(12)` | ❌ Requires restart |
| Frontend inactivity timeout (15 min) | `AppLayout.tsx` → hard-coded `INACTIVITY_TIMEOUT` | ❌ Requires rebuild |
| Session check interval (10 sec) | `AppLayout.tsx` → hard-coded `10000` | ❌ Requires rebuild |
| Default user role on registration | `User.java` → `Role.TESTER` | ❌ Requires rebuild |
| Dashboard polling interval (5 sec) | `DashboardPage.tsx` → `refetchInterval: 5000` | ❌ Requires rebuild |
| Logging level | `application.yml` → `logging.level.*` | ❌ Requires restart |
| Default page sizes | Hard-coded in various pages | ❌ Requires rebuild |
| Encryption key | `application.yml` → `orion.encryption.key` | ❌ Requires restart |

---

## Architecture Design

### Core Concept: Database-Backed `system_settings` Table

Instead of editing YAML files and restarting, we will store all admin-configurable values in a **`system_settings`** database table. Each row is a key-value pair with metadata:

```sql
CREATE TABLE system_settings (
    id            TEXT PRIMARY KEY,
    category      TEXT    NOT NULL,   -- e.g. 'GENERAL', 'SECURITY', 'EXECUTION', 'EMAIL', 'MAINTENANCE'
    setting_key   TEXT    NOT NULL UNIQUE,
    setting_value TEXT    NOT NULL,
    value_type    TEXT    NOT NULL,   -- 'STRING', 'INTEGER', 'BOOLEAN', 'JSON'
    display_name  TEXT    NOT NULL,
    description   TEXT,
    requires_restart BOOLEAN NOT NULL DEFAULT false,
    updated_by    TEXT,
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
);
```

### Hot-Reload vs Restart-Required

| Behaviour | Mechanism |
|-----------|-----------|
| **Hot-reload** settings (e.g., default page size, polling interval, inactivity timeout) | Backend `SystemSettingsService` caches values in-memory. On PUT, cache is invalidated. Frontend fetches `/api/admin/settings` on load. |
| **Restart-required** settings (e.g., JWT secret, SMTP config, thread pool size) | Value is stored in the database. A banner shows `⚠ Changes pending restart`. The admin can trigger a graceful restart from the Maintenance screen (or restart manually). |

### Audit Trail

Every setting change is recorded in the existing `audit_log` table with:
- `entityType = "SYSTEM_SETTING"`
- `entityId = setting_key`
- `previousValue` / `newValue`
- `performedBy` = admin username

---

## Proposed Admin Screens

The Admin Panel will live under the route `/admin/settings` with **tab-based navigation** across 5 screens:

### Screen 1: General Settings (`/admin/settings?tab=general`)

Platform-wide behavioural controls.

| Setting Key | Display Name | Type | Default | Hot-Reload? | Description |
|-------------|-------------|------|---------|-------------|-------------|
| `platform.name` | Platform Name | STRING | `ORION` | ✅ Yes | Displayed in sidebar header and login page |
| `platform.tagline` | Platform Tagline | STRING | `Visual Test Automation` | ✅ Yes | Shown on login page subtitle |
| `ui.default_page_size` | Default Page Size | INTEGER | `10` | ✅ Yes | Default rows shown in all paginated tables |
| `ui.dashboard_poll_interval_ms` | Dashboard Polling Interval | INTEGER | `5000` | ✅ Yes | Milliseconds between dashboard stat refreshes |
| `ui.inactivity_timeout_minutes` | Session Inactivity Timeout | INTEGER | `15` | ✅ Yes | Minutes before auto-logout on inactivity |
| `ui.theme_default` | Default Theme | STRING | `dark` | ✅ Yes | Default theme for new users (`dark` or `light`) |
| `ui.sidebar_default_collapsed` | Sidebar Default Collapsed | BOOLEAN | `false` | ✅ Yes | Whether sidebar starts collapsed |
| `user.default_role` | Default Role for New Users | STRING | `TESTER` | ✅ Yes | Role assigned on self-registration (`TESTER`, `VIEWER`) |
| `user.self_registration_enabled` | Allow Self-Registration | BOOLEAN | `true` | ✅ Yes | Toggle the `/register` endpoint on/off |

---

### Screen 2: Security & Authentication (`/admin/settings?tab=security`)

JWT, CORS, password, and encryption policies.

| Setting Key | Display Name | Type | Default | Hot-Reload? | Description |
|-------------|-------------|------|---------|-------------|-------------|
| `security.jwt_access_token_expiry_ms` | Access Token Expiry | INTEGER | `900000` (15 min) | ⚠️ Restart | Milliseconds before JWT access token expires |
| `security.jwt_refresh_token_expiry_ms` | Refresh Token Expiry | INTEGER | `604800000` (7 days) | ⚠️ Restart | Milliseconds before refresh token expires |
| `security.bcrypt_rounds` | BCrypt Strength (Rounds) | INTEGER | `12` | ⚠️ Restart | Hashing cost factor for new passwords |
| `security.cors_allowed_origins` | CORS Allowed Origins | STRING | `http://localhost:5173` | ⚠️ Restart | Comma-separated list of allowed frontend origins |
| `security.password_min_length` | Minimum Password Length | INTEGER | `8` | ✅ Yes | Enforced on registration and password change |
| `security.max_login_attempts` | Max Login Attempts | INTEGER | `5` | ✅ Yes | Lock account after N consecutive failed logins |
| `security.lockout_duration_minutes` | Account Lockout Duration | INTEGER | `30` | ✅ Yes | Minutes an account stays locked after max failures |

---

### Screen 3: Execution Engine (`/admin/settings?tab=execution`)

Controls for the test execution runtime.

| Setting Key | Display Name | Type | Default | Hot-Reload? | Description |
|-------------|-------------|------|---------|-------------|-------------|
| `execution.thread_pool_core_size` | Core Thread Pool Size | INTEGER | `1` | ⚠️ Restart | Minimum threads for parallel executions |
| `execution.thread_pool_max_size` | Max Thread Pool Size | INTEGER | `1` | ⚠️ Restart | Maximum threads for parallel executions |
| `execution.thread_pool_queue_capacity` | Queue Capacity | INTEGER | `1000` | ⚠️ Restart | Max queued execution requests |
| `execution.default_step_timeout_ms` | Default Step Timeout | INTEGER | `30000` | ✅ Yes | Default timeout per step if not specified |
| `execution.screenshot_storage_path` | Screenshot Storage Path | STRING | `storage/screenshots` | ⚠️ Restart | Filesystem directory for browser screenshots |
| `execution.max_parallel_browsers` | Max Parallel Browsers | INTEGER | `2` | ✅ Yes | Limit concurrent Playwright browser instances |
| `execution.auto_cleanup_days` | Execution Auto-Cleanup (days) | INTEGER | `90` | ✅ Yes | Delete execution records older than N days (0 = never) |
| `execution.retry_on_failure` | Retry Failed Steps | BOOLEAN | `false` | ✅ Yes | Automatically retry failed steps once before marking FAILED |

---

### Screen 4: Email & Notifications (`/admin/settings?tab=email`)

SMTP configuration and notification rules.

| Setting Key | Display Name | Type | Default | Hot-Reload? | Description |
|-------------|-------------|------|---------|-------------|-------------|
| `email.smtp_host` | SMTP Host | STRING | `localhost` | ⚠️ Restart | Mail server hostname |
| `email.smtp_port` | SMTP Port | INTEGER | `1025` | ⚠️ Restart | Mail server port |
| `email.smtp_username` | SMTP Username | STRING | *(empty)* | ⚠️ Restart | Authentication username |
| `email.smtp_password` | SMTP Password | STRING | *(empty)* | ⚠️ Restart | Authentication password (stored encrypted) |
| `email.smtp_auth` | SMTP Auth Required | BOOLEAN | `false` | ⚠️ Restart | Whether SMTP server requires authentication |
| `email.smtp_starttls` | SMTP STARTTLS | BOOLEAN | `false` | ⚠️ Restart | Enable STARTTLS encryption |
| `email.sender_address` | Sender Email Address | STRING | `noreply@orion-testing.com` | ⚠️ Restart | "From" address on all outgoing emails |
| `email.notify_on_failure` | Notify on Test Failure | BOOLEAN | `false` | ✅ Yes | Auto-send email to test owner on FAILED execution |
| `email.notify_recipients` | Default Notification Recipients | STRING | *(empty)* | ✅ Yes | Comma-separated list of emails for failure alerts |

---

### Screen 5: Maintenance & Diagnostics (`/admin/settings?tab=maintenance`)

System health, logs, and operational controls.

| Setting Key | Display Name | Type | Default | Hot-Reload? | Description |
|-------------|-------------|------|---------|-------------|-------------|
| `logging.root_level` | Root Log Level | STRING | `INFO` | ⚠️ Restart | Root logger level (`DEBUG`, `INFO`, `WARN`, `ERROR`) |
| `logging.orion_level` | ORION App Log Level | STRING | `INFO` | ⚠️ Restart | `com.axon.orion` logger level |
| `logging.sql_level` | SQL Log Level | STRING | `WARN` | ⚠️ Restart | Hibernate SQL logger level |

**Plus read-only diagnostics tiles:**

| Tile | Data Source | Description |
|------|------------|-------------|
| System Uptime | `ManagementFactory.getRuntimeMXBean().getUptime()` | Time since last JVM start |
| JVM Memory Usage | `Runtime.getRuntime().totalMemory()` / `freeMemory()` | Heap usage bar chart |
| Active Threads | Thread pool executor stats | Current / max / queued thread counts |
| Database Size | File size for SQLite, `pg_database_size` for Postgres | Storage consumed |
| Total Users | `userRepository.count()` | Registered user count |
| Total Applications | `applicationRepository.count()` | App count |
| Total Executions | `executionRepository.count()` | All-time execution count |
| Pending Restart | flag | Whether any restart-required settings have been changed |

**Maintenance Actions (buttons):**

| Action | Description | Danger Level |
|--------|-------------|-------------|
| 🧹 Purge Old Executions | Delete executions older than `execution.auto_cleanup_days` | ⚠️ Confirm |
| 🧹 Clear Screenshot Storage | Delete all screenshots from disk | ⚠️ Confirm |
| 📋 Export All Settings | Download current `system_settings` as JSON | Safe |
| 📋 Import Settings | Upload a JSON file to bulk-update settings | ⚠️ Confirm |
| 🔄 Restart Application | Trigger a graceful Spring Boot restart | 🔴 Critical Confirm |
| 📊 View Audit Log | Navigate to a filtered audit log view for `SYSTEM_SETTING` changes | Safe |

---

## Proposed Changes

### Backend

#### [NEW] Flyway Migration: `V18__create_system_settings_table.sql`
- Create `system_settings` table.
- Seed default values for all settings listed above.

---

#### [NEW] Entity: `SystemSetting.java`
- Package: `com.axon.orion.admin.entity`
- Fields: `id`, `category`, `settingKey`, `settingValue`, `valueType`, `displayName`, `description`, `requiresRestart`, `updatedBy`
- Extends `BaseEntity` for `createdAt`/`updatedAt`.

#### [NEW] Repository: `SystemSettingRepository.java`
- `findBySettingKey(String key)`
- `findByCategory(String category)`
- `findAll()`

#### [NEW] DTO: `AdminDtos.java`
- `SystemSettingDto` — full setting including metadata for the UI.
- `UpdateSettingRequest` — `settingValue` only.
- `SystemDiagnosticsDto` — uptime, memory, threads, counts, pendingRestart flag.

#### [NEW] Service: `SystemSettingsService.java`
- In-memory `ConcurrentHashMap<String, String>` cache loaded on startup.
- `getString(key, default)`, `getInt(key, default)`, `getBoolean(key, default)` — used by all backend services.
- `updateSetting(key, value, updatedBy)` — writes to DB, invalidates cache, records audit log, sets `pendingRestart` flag if `requiresRestart == true`.
- `getAllByCategory(category)` — for frontend rendering.
- `getDiagnostics()` — gathers runtime metrics.
- `exportSettings()` / `importSettings(json)` — bulk operations.

#### [NEW] Controller: `AdminSettingsController.java`
- `GET  /api/admin/settings` — list all settings (grouped by category).
- `GET  /api/admin/settings/{key}` — get single setting.
- `PUT  /api/admin/settings/{key}` — update a setting value.
- `GET  /api/admin/diagnostics` — get system diagnostics.
- `POST /api/admin/maintenance/purge-executions` — purge old executions.
- `POST /api/admin/maintenance/clear-screenshots` — clear screenshot storage.
- `GET  /api/admin/settings/export` — export settings JSON.
- `POST /api/admin/settings/import` — import settings JSON.
- `GET  /api/admin/settings/public` — **unauthenticated** endpoint returning only UI-facing settings (platform name, self-registration toggle, default theme) for login page customisation.
- All endpoints (except `public`) require `@PreAuthorize("hasRole('ADMIN')")`.

#### [MODIFY] Existing Services
- Refactor `AsyncConfig.java`, `SecurityConfig.java`, `JwtUtil.java`, `ExecutionReportService.java`, `EncryptionService.java` to read from `SystemSettingsService` instead of `@Value` annotations where applicable (hot-reload settings use live cache; restart-required settings use `@Value` with DB-seeded defaults).

---

### Frontend

#### [NEW] Page: `AdminSettingsPage.tsx`
- Route: `/admin/settings`
- Tab-based navigation with 5 tabs matching the backend categories.
- Each tab renders a list of setting cards grouped by function.
- Each setting card shows: display name, description, current value, input control (text/number/boolean toggle/select), and a "⚠️ Requires Restart" badge where applicable.
- A floating "Save Changes" button appears when any values are dirty.
- A **"Pending Restart"** banner at the top when restart-required settings have been modified since last boot.

#### [NEW] Page: `AdminAuditLogPage.tsx`
- Route: `/admin/audit-log`
- Paginated table of `audit_log` entries filtered to `SYSTEM_SETTING` entity type.
- Columns: Setting Key, Previous Value, New Value, Changed By, Timestamp.
- Search/filter by key or user.

#### [MODIFY] `App.tsx`
- Add routes:
  - `/admin/settings` → `<AdminSettingsPage />`
  - `/admin/audit-log` → `<AdminAuditLogPage />`
- Both wrapped in `<ProtectedRoute allowedRoles={['ADMIN']}>`.

#### [MODIFY] `Sidebar.tsx`
- Add new admin nav item: `{ to: '/admin/settings', label: 'System Settings', icon: Sliders }`.
- Add new admin nav item: `{ to: '/admin/audit-log', label: 'Audit Log', icon: ScrollText }`.

#### [MODIFY] `AppLayout.tsx`
- Replace hard-coded `INACTIVITY_TIMEOUT` with a value fetched from `/api/admin/settings/public` (or a local settings store).

#### [MODIFY] `DashboardPage.tsx`
- Replace hard-coded `refetchInterval: 5000` with a value from the settings store.

#### [NEW] Store: `system-settings-store.ts`
- Zustand store that fetches public UI settings on app load.
- Provides `getSetting(key, default)` helper consumed by `AppLayout`, `DashboardPage`, and other components.

---

## UI Design Concept

Each settings screen follows a consistent card-based layout:

```
┌─────────────────────────────────────────────────────────────┐
│ ⚙ System Settings                                         │
│ Configure platform behaviour, security, and runtime engine │
├─────────────────────────────────────────────────────────────┤
│ [General] [Security] [Execution] [Email] [Maintenance]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠ PENDING RESTART — 2 settings require a system restart   │
│  [View Changes]  [Restart Now]                              │
│                                                             │
│  ┌─ Platform Identity ──────────────────────────────────┐   │
│  │  Platform Name        [ORION____________]            │   │
│  │  Platform Tagline     [Visual Test Automation___]    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ UI Behaviour ───────────────────────────────────────┐   │
│  │  Default Page Size         [10 ▾]                    │   │
│  │  Dashboard Polling (ms)    [5000________]            │   │
│  │  Inactivity Timeout (min)  [15__________]            │   │
│  │  Default Theme             [dark ▾]                  │   │
│  │  Sidebar Collapsed         [○ off]                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ User Policies ──────────────────────────────────────┐   │
│  │  Default Role              [TESTER ▾]                │   │
│  │  Allow Self-Registration   [● on]                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│                          [💾 Save Changes]                  │
└─────────────────────────────────────────────────────────────┘
```

The **Maintenance** tab has a different layout — diagnostic tiles at the top, and maintenance action buttons below.

---

## Open Questions

> [!IMPORTANT]
> 1. **Graceful Restart**: Should the "Restart Application" button call `SpringApplication.exit()` + process manager restart (e.g., systemd), or should it use Spring Boot DevTools' live-reload? For production, a process-manager restart is safer.

> [!IMPORTANT]
> 2. **Settings Import/Export**: Should the export include restart-required sensitive values (like SMTP password, encryption key), or should those be excluded by default for security?

> [!NOTE]
> 3. **Login Page Customisation**: The `/api/admin/settings/public` endpoint will expose non-sensitive settings to the login page (platform name, tagline, self-registration toggle). Should we also support a custom logo upload in a future iteration?

---

## Verification Plan

### Automated Tests
- `mvn compile` — backend compilation check.
- `npm.cmd run build` — frontend TypeScript and bundle check.

### Manual Verification
- Log in as admin → navigate to `/admin/settings`.
- Modify a hot-reload setting (e.g., `ui.default_page_size` from 10 → 25) → verify tables across the app immediately reflect 25 rows.
- Modify a restart-required setting (e.g., `execution.thread_pool_core_size`) → verify the "Pending Restart" banner appears.
- Export settings → modify JSON → import → verify values updated.
- Check `audit_log` table for change records.
- Purge old executions → verify count decreases.
