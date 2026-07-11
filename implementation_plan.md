# MAINFRAME_TERMINAL — New Step Type for Mainframe Connectivity, Navigation & Screenshot

Add a new `MAINFRAME_TERMINAL` step type to ORION that connects to IBM Mainframe (3270) terminals, performs screen navigation (send keys, input fields, function keys), and captures terminal screenshots — following the exact same architecture patterns as the existing `BROWSER_AUTOMATION` step.

---

## Approach Comparison

There are **3 viable approaches** for implementing mainframe connectivity from a Java/Spring Boot backend. Each has different tradeoffs:

| Criteria | Approach A: **tn3270j (Pure Java)** | Approach B: **x3270/s3270 (CLI Process)** | Approach C: **Playwright + Web-based 3270 Emulator** |
|---|---|---|---|
| **How it works** | Pure Java TN3270 library embeds the emulator directly in the JVM. Communicates via TN3270/TN3270E protocol natively. | Shells out to the `s3270` (scriptable 3270) command-line tool via `ProcessBuilder`. Parses stdout for screen data. | Navigates to a web-based 3270 terminal (e.g., IBM Host on-Demand, Zowe, or Mocha) using Playwright, then screenshots the browser page. |
| **Dependencies** | `tn3270j` Maven artifact (or `h3270`/`jtn3270`) — no native OS binaries needed. | Requires `x3270` / `s3270` binary installed on the host OS (Linux/Mac/Windows). | Reuses existing Playwright dependency. Requires a web-based 3270 emulator endpoint to be accessible. |
| **Screenshot quality** | Programmatic text-mode screen capture → rendered to image via Java2D / buffered image. Pixel-perfect retro green-screen look. | `s3270` can dump screen buffer as text → render to image, or use `x3270` GUI mode for native screenshots. | Real browser screenshot of the web emulator UI — highest visual fidelity since it captures the actual emulator. |
| **Portability** | ✅ Fully portable (pure Java). Runs anywhere the JVM runs. | ⚠️ Requires OS-level package install (`apt install x3270` / `choco install x3270`). Docker-friendly but adds system dependency. | ⚠️ Requires an accessible web-based 3270 emulator endpoint. Infrastructure overhead. |
| **Field-level control** | ✅ Full programmatic control — read/write fields by position, send PF keys, read screen buffer, cursor positioning. | ✅ Full control via `s3270` scripting language (`Connect`, `String`, `PF`, `Ascii`, `Snap`). Well-documented. | ⚠️ Limited — relies on CSS selectors / DOM manipulation of the web emulator. Fragile if emulator UI changes. |
| **Complexity** | 🟢 Low — library API, no external processes. | 🟡 Medium — process management, output parsing, binary installation. | 🔴 High — depends on external web emulator, Playwright page interaction, fragile selectors. |
| **Best for** | Production-grade mainframe testing with no external dependencies. **Recommended for ORION.** | Teams already using x3270 tools and comfortable with CLI integration. | Organizations that already have a web-based 3270 emulator deployed and want visual browser-style screenshots. |

> [!IMPORTANT]
> **Recommendation: Approach A (Pure Java tn3270j)** is the best fit for ORION because:
> 1. Zero external dependencies — consistent with how `BrowserAutomationExecutor` bundles Playwright.
> 2. Full programmatic field-level control for reading/writing mainframe screens.
> 3. Portable across all OS environments (dev, Docker, CI/CD).
> 4. Screenshots are rendered server-side via Java2D with a classic green-screen aesthetic.

---

## Open Questions

> [!IMPORTANT]
> **Which approach do you prefer?** The plan below details **Approach A (Pure Java)** as the default. If you prefer Approach B or C, let me know and I'll adjust.

> [!NOTE]
> **TN3270 library choice**: The most mature pure-Java TN3270 libraries are:
> - `tn3270j` — lightweight, well-tested
> - `dm3270` (open-source fork) — used by some enterprise tools
> - Custom socket-based TN3270 protocol implementation
>
> I recommend starting with a well-tested open-source library. If none fit perfectly, we can implement a lightweight TN3270 protocol handler.

---

## Proposed Changes

### Overview — Files to Touch

The new step follows the **exact same pattern** as `BROWSER_AUTOMATION`. Here's every file that needs changes:

```
Backend (Java):
  [NEW]  MainframeTerminalExecutor.java        — StepExecutor implementation
  [MODIFY] TestStep.java                        — Add MAINFRAME_TERMINAL to StepType enum
  [MODIFY] pom.xml                              — Add TN3270 dependency

Frontend (React/TypeScript):
  [NEW]  MainframeTerminalConfig.tsx            — Step config form component
  [MODIFY] api.ts                               — Add MainframeAction interface + StepConfig fields
  [MODIFY] StepTypeSelector.tsx                 — Add step option in Primary Steps column
  [MODIFY] StepNode.tsx                         — Add icon + color mapping
  [MODIFY] StepConfigPanel.tsx                  — Register config component
```

---

### Backend — Execution Engine

#### [MODIFY] [TestStep.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/testcase/entity/TestStep.java)

Add `MAINFRAME_TERMINAL` to the `StepType` enum (line 50):

```diff
 public enum StepType {
-    HTTP_REQUEST, ASSERTION, DELAY, SET_VARIABLE, CONDITIONAL, LOOP, SCRIPT, LOG, DATABASE_QUERY, GLOBAL_REF, PARALLEL, SOAP_REQUEST, DB_TABLE_VIEW, BROWSER_AUTOMATION, CSV_EXTRACT
+    HTTP_REQUEST, ASSERTION, DELAY, SET_VARIABLE, CONDITIONAL, LOOP, SCRIPT, LOG, DATABASE_QUERY, GLOBAL_REF, PARALLEL, SOAP_REQUEST, DB_TABLE_VIEW, BROWSER_AUTOMATION, CSV_EXTRACT, MAINFRAME_TERMINAL
 }
```

---

#### [MODIFY] [pom.xml](file:///d:/Projects/orion/orion-backend/pom.xml)

Add TN3270 Java library dependency. The exact artifact depends on approach:

**Approach A** — Add a pure Java TN3270 library (e.g., `dm3270` open-source or custom socket):
```xml
<!-- TN3270 Terminal Emulator for Mainframe connectivity -->
<dependency>
    <groupId>com.bytezone</groupId>
    <artifactId>dm3270</artifactId>
    <version>1.0.0</version>
</dependency>
```

> If no suitable Maven artifact exists, we implement a lightweight TN3270 socket client directly (the protocol is well-documented — RFC 1576/2355). This is ~300-400 lines of Java code for basic connect, send, receive, and screen buffer parsing.

---

#### [NEW] [MainframeTerminalExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/MainframeTerminalExecutor.java)

A new `StepExecutor` implementation (~200-250 lines) following the same pattern as [BrowserAutomationExecutor.java](file:///d:/Projects/orion/orion-backend/src/main/java/com/axon/orion/execution/engine/BrowserAutomationExecutor.java):

**Config JSON structure** (what the user configures in the frontend):
```json
{
  "host": "mainframe.example.com",
  "port": 23,
  "useSsl": false,
  "terminalType": "IBM-3278-2",
  "codePage": "CP037",
  "connectTimeoutMs": 10000,
  "actions": [
    { "type": "waitForField", "timeout": 5000 },
    { "type": "input", "row": 6, "col": 20, "value": "{{userId}}" },
    { "type": "input", "row": 7, "col": 20, "value": "{{password}}" },
    { "type": "sendKey", "key": "ENTER" },
    { "type": "waitForText", "text": "READY", "timeout": 10000 },
    { "type": "screenshot", "name": "login_success" },
    { "type": "sendKey", "key": "PF3" },
    { "type": "readField", "row": 1, "col": 1, "length": 80, "variableName": "screenTitle" },
    { "type": "screenshot", "name": "after_navigation" }
  ]
}
```

**Supported action types:**

| Action | Description | Parameters |
|--------|-------------|------------|
| `waitForField` | Wait until the terminal shows an unlocked input field | `timeout` |
| `waitForText` | Wait until specific text appears on screen | `text`, `row` (optional), `col` (optional), `timeout` |
| `input` | Type text into a field at a specific screen position | `row`, `col`, `value` |
| `sendKey` | Send a terminal key (ENTER, PF1-PF24, TAB, CLEAR, PA1-PA3, ATTN, etc.) | `key` |
| `screenshot` | Capture current terminal screen as PNG image | `name` |
| `readField` | Read text from screen at position and optionally save as variable | `row`, `col`, `length`, `variableName` (optional) |
| `sleep` | Pause between actions | `duration` (ms) |

**Screenshot rendering**: The executor reads the 80×24 (or 80×43) character screen buffer and renders it to a PNG using Java2D — drawing green text on a black background with a monospace font, producing the classic mainframe terminal look. Screenshots are saved to `storage/screenshots/` (same directory as browser screenshots).

**Key implementation details:**
- Connection lifecycle: Opens TN3270 socket → authenticates TLS if `useSsl=true` → executes actions sequentially → disconnects
- Variable interpolation: All `value` fields support `{{variableName}}` syntax (resolved by the engine before reaching the executor)
- Error handling: Each action logs success/failure; first failure aborts (consistent with `BrowserAutomationExecutor`)
- Auto-registered via `@Component` + Spring DI — the `ExecutionEngine` constructor automatically picks it up

---

### Frontend — Config Form & UI

#### [MODIFY] [api.ts](file:///d:/Projects/orion/orion-frontend/src/types/api.ts)

Add `MainframeAction` interface and extend `StepConfig`:

```typescript
export interface MainframeAction {
  type: 'waitForField' | 'waitForText' | 'input' | 'sendKey' | 'screenshot' | 'readField' | 'sleep';
  row?: number;
  col?: number;
  value?: string;
  key?: string;
  text?: string;
  length?: number;
  variableName?: string;
  timeout?: number;
  duration?: number;
  name?: string;
}
```

Add to `StepConfig` interface:
```typescript
// Mainframe Terminal
mainframeHost?: string;
mainframePort?: number;
useSsl?: boolean;
terminalType?: string;
codePage?: string;
connectTimeoutMs?: number;
mainframeActions?: MainframeAction[];
```

---

#### [NEW] [MainframeTerminalConfig.tsx](file:///d:/Projects/orion/orion-frontend/src/components/workflow/step-configs/MainframeTerminalConfig.tsx)

A new config form component (~400-500 lines) modeled after [BrowserAutomationConfig.tsx](file:///d:/Projects/orion/orion-frontend/src/components/workflow/step-configs/BrowserAutomationConfig.tsx):

**Form sections:**
1. **Connection Settings** — Host, Port, SSL toggle, Terminal Type dropdown (`IBM-3278-2`, `IBM-3278-3`, `IBM-3278-4`, `IBM-3278-5`), Code Page dropdown, Connect Timeout
2. **Actions Builder** — Dynamic list of actions with add/remove/reorder:
   - Each action has a type dropdown and contextual fields
   - `input` shows row, col, value fields
   - `sendKey` shows a key dropdown (ENTER, PF1-PF24, TAB, CLEAR, PA1-PA3, ATTN, RESET, etc.)
   - `waitForText` shows text field + optional row/col + timeout
   - `waitForField` shows timeout
   - `screenshot` shows name field
   - `readField` shows row, col, length, variableName
   - `sleep` shows duration

---

#### [MODIFY] [StepTypeSelector.tsx](file:///d:/Projects/orion/orion-frontend/src/components/workflow/StepTypeSelector.tsx)

Add to the `primaryOptions` array (alongside HTTP_REQUEST, SOAP_REQUEST, DATABASE_QUERY, BROWSER_AUTOMATION):

```typescript
{
  type: 'MAINFRAME_TERMINAL',
  name: 'Mainframe Terminal',
  description: 'Connect to 3270 mainframe terminals, navigate screens, and capture screenshots',
  icon: <Monitor className="h-5 w-5 text-lime-400" />,
  colorClass: 'bg-lime-500/10 hover:bg-lime-500/20 border-lime-500/30'
}
```

Using `Monitor` icon from Lucide with a **lime green** color scheme — visually distinctive and evocative of classic green-screen terminals.

---

#### [MODIFY] [StepNode.tsx](file:///d:/Projects/orion/orion-frontend/src/components/workflow/StepNode.tsx)

Add case to `getStepIcon()`:
```typescript
case 'MAINFRAME_TERMINAL':
  return <Monitor className="h-5 w-5 text-lime-400" />;
```

Add case to `getStepColorClass()`:
```typescript
case 'MAINFRAME_TERMINAL': return 'border-lime-500/30 bg-lime-500/5';
```

---

#### [MODIFY] [StepConfigPanel.tsx](file:///d:/Projects/orion/orion-frontend/src/components/workflow/StepConfigPanel.tsx)

Import and register:
```typescript
import { MainframeTerminalConfig } from './step-configs/MainframeTerminalConfig';
```

Add to `configRegistry`:
```typescript
MAINFRAME_TERMINAL: (
  <MainframeTerminalConfig
    step={step}
    handleConfigChange={handleConfigChange}
  />
),
```

---

## Verification Plan

### Automated Tests
- `mvn clean compile` — Verify backend compiles with the new enum value and executor class.
- `npm run build` — Verify frontend compiles with new types and component.

### Manual Verification
1. Start the backend and frontend dev servers.
2. Create a new test case → open the step selector → verify "Mainframe Terminal" appears in Primary Steps with a lime-green icon.
3. Add the step → verify the config panel renders connection settings and action builder.
4. (If a test mainframe endpoint is available) Execute the step and verify:
   - Connection establishes
   - Actions execute in sequence
   - Screenshots are captured and visible in execution logs
5. Verify the step is visible in the workflow canvas with correct icon and color.
