# Web Automation & Screenshot Step - Requirements and Implementation Plan

This document outlines the requirements and technical plan for introducing a new workflow step capable of performing complex browser interactions (such as logging in via SAML/SSO or standard credentials, navigating through an application, and interacting with elements) and finally capturing screenshots to include in execution reports.

## 1. Requirements

### Functional Requirements
- **Browser Automation:** The system must launch a headless web browser to perform automated tasks.
- **Complex Interactions:** The step configuration must support a sequence of actions rather than just a single URL. It needs to handle:
  - Navigating to URLs.
  - Filling out forms (e.g., username, password fields).
  - Clicking buttons and links.
  - Waiting for elements to appear or network idle states (crucial for SAML/SSO redirects).
- **Authentication Support:** Must handle standard login flows and multi-step SSO/SAML redirects natively.
- **Dynamic Screenshots:** The ability to take a screenshot at specific points in the interaction flow (or at the very end).
- **Storage:** Captured screenshots must be securely saved and persisted on the backend.
- **Reporting Integration:** Execution reports must display the captured screenshots alongside the step execution details.

### Non-Functional Requirements
- **Security:** Credentials used for login actions MUST be masked or referenced securely (e.g., resolving secrets from a vault or secure environment variables) rather than stored in plain text in the step configuration.
- **Performance:** Browser sessions should be managed efficiently and closed properly to prevent memory leaks and zombie processes.
- **Resilience:** The executor must handle timeouts and element-not-found exceptions gracefully, failing the step with a clear error message rather than hanging indefinitely.

---

## 2. Technical Implementation Plan

### Phase 1: Dependency Integration
**Proposed Library: Playwright for Java**
- *Why Playwright?* It is the industry standard for modern, reliable end-to-end browser automation. It excels at handling complex scenarios like SSO redirects, single-page application (SPA) state changes, and waiting for elements without flaky "sleep" commands. It automatically waits for elements to be actionable before clicking or typing.
- **Action:** Add `com.microsoft.playwright:playwright` dependency to `orion-backend/pom.xml`.

### Phase 2: Domain & Configuration Model Updates
Instead of a simple URL, the step configuration needs to define a script or a sequence of actions. 

**Model: `WebAutomationStepConfig`**
A JSON representation of the actions required to reach the target state.
```json
{
  "viewportWidth": 1920,
  "viewportHeight": 1080,
  "actions": [
    { "type": "navigate", "url": "https://example.com/login" },
    { "type": "fill", "selector": "#username", "value": "${secrets.APP_USER}" },
    { "type": "fill", "selector": "#password", "value": "${secrets.APP_PASS}" },
    { "type": "click", "selector": "#login-btn" },
    { "type": "waitForElement", "selector": ".dashboard-header" },
    { "type": "click", "selector": "#report-tab" },
    { "type": "screenshot", "name": "final_result" }
  ]
}
```
- **Result Model:** Update `StepExecutionResult` or log context to support a list of attachments or file paths, as multiple screenshots could be taken during a single step.

### Phase 3: Step Executor Implementation (`WebAutomationStepExecutor`)
- **Execution Engine:** Implement an executor that iterates through the `actions` array and maps them to Playwright API calls.
  - `navigate` -> `page.navigate(url)`
  - `fill` -> `page.locator(selector).fill(value)` *(Note: Ensure secret resolution happens before passing the value).*
  - `click` -> `page.locator(selector).click()`
  - `waitForElement` -> `page.locator(selector).waitFor()`
  - `screenshot` -> `page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get(storagePath)))`
- **SAML/SSO Handling:** Playwright's auto-waiting mechanism handles redirects natively. As long as we configure a `waitForElement` for the element that appears *after* the SAML flow completes (e.g., the dashboard), Playwright will seamlessly wait through all the intermediate redirect hops.

### Phase 4: Storage & Reporting Integration
- **Storage Strategy:** Save the images from Playwright as `.png` files in a dedicated `storage/screenshots` directory with unique names (e.g., `<executionId>_<stepId>_<actionIndex>.png`).
- **Report Updates:** Update `ExecutionReportService` to identify screenshots in the `StepExecutionResult`, encode them as Base64 strings, and embed them directly into the HTML report template using `<img>` tags.

### Phase 5: Frontend UI Updates
- **Action Builder:** The step builder UI needs to be upgraded from a simple URL text field to an ordered list builder where users can add, remove, and reorder specific UI actions (Navigate, Type, Click, Wait, Screenshot).
