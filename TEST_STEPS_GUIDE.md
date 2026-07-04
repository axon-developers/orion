# Orion Test Steps - Comprehensive User Guide

Welcome to the **Orion Test Case Workflow Builder & Execution Platform**. This guide provides a detailed reference for each step type available in the visual workflow designer, including their configuration parameters, behaviors, and real-world examples.

---

## Table of Contents
1. [Variable Interpolation Syntax](#variable-interpolation-syntax)
2. [Primary Test Steps](#1-primary-test-steps)
   - [HTTP Request (REST)](#http-request-rest)
   - [SOAP Request](#soap-request)
   - [Database Query](#database-query)
3. [Support Steps](#2-support-steps)
   - [Validation Assertion](#validation-assertion)
   - [Extract Variable](#extract-variable)
4. [Technical Steps](#3-technical-steps)
   - [Delay/Pause](#delaypause)
   - [Conditional Branch](#conditional-branch)
   - [Loop Iteration](#loop-iteration)
   - [Log Message](#log-message)
   - [Custom Script](#custom-script)
   - [Parallel Group](#parallel-group)
   - [Reusable Global Step Template](#reusable-global-step-template)

---

## Variable Interpolation Syntax

Throughout your workflow configurations, you can dynamically inject variables saved from previous execution steps or environment definitions.

- **Syntax:** `{{variableName}}`
- **Supported Fields:** Request URLs, Request Headers, JSON payloads, SOAP envelopes, SQL queries, log messages, and branch conditions.
- **Example:**
  If you have an environment variable `baseUrl` set to `https://api.example.com` and a saved runtime variable `token` set to `jwt-123456`, you can configure an HTTP Request URL as:
  ```text
  {{baseUrl}}/v1/users
  ```
  And a Header as:
  ```text
  Bearer {{token}}
  ```

---

## 1. Primary Test Steps

Primary steps execute external communications (network requests or database statements). They serve as the foundation of your test workflow, and support steps are attached to them horizontally.

### HTTP Request (REST)
Executes a RESTful API request using standard HTTP protocols.

#### Configuration Parameters
- **HTTP Method:** `GET` | `POST` | `PUT` | `DELETE` | `PATCH`
- **Request URL:** Endpoint target (e.g. `{{baseUrl}}/api/users`). Supports variable interpolation.
- **Request Body Type:** `NONE` | `JSON`
- **JSON Body Payload:** (Only if Body Type is `JSON`). A raw JSON structure or string. Can use interpolation placeholders.
- **Timeout (ms):** Maximum duration (defaults to `30000`) before the step fails.

#### Real-world Example
Making a `POST` request to create a new user profile:
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/users`
- **Body Type:** `JSON`
- **JSON Payload:**
  ```json
  {
    "username": "tester_john",
    "email": "john.doe@example.com",
    "role": "DEVELOPER"
  }
  ```

---

### SOAP Request
Performs a SOAP XML request utilizing XML-wrapped envelopes.

#### Configuration Parameters
- **SOAP Endpoint URL:** SOAP service target URL (e.g. `https://www.w3schools.com/xml/tempconvert.asmx`).
- **SOAP Version:** `SOAP 1.1` | `SOAP 1.2`
- **SOAP Action:** (SOAP 1.1 only). The `SOAPAction` header identifier.
- **Request Envelope (XML):** The raw XML body enclosing the envelopes.
- **Timeout (ms):** Connection timeout threshold.

#### Real-world Example
Invoking a Celsius-to-Fahrenheit temperature conversion SOAP service:
- **Endpoint URL:** `https://www.w3schools.com/xml/tempconvert.asmx`
- **Version:** `SOAP 1.1`
- **SOAP Action:** `https://www.w3schools.com/xml/CelsiusToFahrenheit`
- **Envelope:**
  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <CelsiusToFahrenheit xmlns="https://www.w3schools.com/xml/">
        <Celsius>37</Celsius>
      </CelsiusToFahrenheit>
    </soap:Body>
  </soap:Envelope>
  ```

---

### Database Query
Runs a SQL query or command against a configured JDBC-compatible database.

#### Configuration Parameters
- **JDBC Connection String:** Database URL (e.g. `jdbc:sqlite:./data/orion.db` or `{{dbConnectionString}}`).
- **SQL Query Command:** The SQL statement to run (e.g. `SELECT`, `UPDATE`, `INSERT`).
- **Save Result to Variable:** Name of the variable to store the query result (e.g. rows returned or count).

#### Real-world Example
Verifying active user counts:
- **JDBC String:** `jdbc:sqlite:./orion.db`
- **SQL Command:**
  ```sql
  SELECT count(*) as total FROM users WHERE is_active = 1
  ```
- **Save Variable:** `activeUserCount`
- *(Note: The variable `{{activeUserCount}}` will store the numeric result, which you can assert in subsequent support steps.)*

---

## 2. Support Steps

Support steps depend directly on a Primary step and are placed horizontally to validate response payloads or extract variables from the execution context.

### Validation Assertion
Validates properties from the parent step's execution result (headers, status codes, bodies, etc.).

#### Configuration Parameters
- **Target Source:**
  - `Response Body (JSON/XML)`
  - `HTTP Status Code`
  - `HTTP Header`
  - `Saved Variable`
- **Payload Format:** (For Response Body) `JSON (JSONPath)` | `XML/SOAP (XPath)`
- **Path Selection Selector:**
  - **JSONPath Selector:** (e.g. `$.status` or `$.data.id`).
  - **XPath Expression:** (e.g. `//CelsiusToFahrenheitResult/text()`).
- **Header Name:** (For HTTP Header) E.g. `Content-Type`.
- **Variable Name:** (For Saved Variable) E.g. `activeUserCount`.
- **Operator:** `Equals` | `Not Equals` | `Contains` | `Greater Than` | `Less Than` | `Regex Match`
- **Expected Value:** Target string/value for comparison (e.g. `200` or `active`).
- **Failure Message:** Custom description displayed if the verification fails.

#### Real-world Examples
1. **Assert HTTP Status is 201 Created:**
   - **Source:** `HTTP Status Code`
   - **Operator:** `Equals`
   - **Expected Value:** `201`
   - **Failure Message:** `User creation failed!`

2. **Assert JSON response body "role" is "ADMIN":**
   - **Source:** `Response Body (JSON)`
   - **JSONPath:** `$.user.role`
   - **Operator:** `Equals`
   - **Expected Value:** `ADMIN`

---

### Extract Variable
Extracts values from execution responses and saves them to the runtime variables cache.

#### Configuration Parameters
- **Variable Save Key:** Name under which to cache the extracted variable (e.g. `authToken`).
- **Extraction Source:** `Response Body` | `Response Header`
- **Payload Format:** (For Response Body) `JSON (JSONPath)` | `XML/SOAP (XPath)`
- **Path Selection Selector:** `JSONPath Selector` or `XPath Expression` based on format.
- **Header Name:** (For Response Header) E.g. `Authorization` or `Set-Cookie`.

#### Real-world Example
Extracting a Bearer Token from a login HTTP response:
- **Variable Save Key:** `userToken`
- **Source:** `Response Body (JSON)`
- **JSONPath Selector:** `$.data.token`
- *(Note: Once saved, subsequent steps can access it using `{{userToken}}`).*

---

## 3. Technical Steps

Technical steps govern orchestrations, delays, loops, or environment-wide configurations.

### Delay/Pause
Pauses workflow execution for a predefined number of milliseconds. Useful for waiting for async processes or rate-limiting.

#### Configuration Parameters
- **Duration (milliseconds):** Delay duration (e.g. `2000` for 2 seconds).

#### Real-world Example
- **Duration:** `5000` (pauses execution for 5 seconds before moving to next step).

---

### Conditional Branch
Executes succeeding steps conditionally depending on a Boolean statement.

#### Configuration Parameters
- **Branch Condition:** Expression to evaluate (e.g. `{{statusCode}} == 200`).

#### Real-world Example
- **Condition:** `{{activeUserCount}} > 10`
- *(Note: Steps downstream are bypassed if the expression evaluates to false.)*

---

### Loop Iteration
Repeats steps iteratively using indices or element traversal.

#### Configuration Parameters
- **Loop Type:**
  - `Fixed Count Iterations` (COUNT)
  - `For Each Element` (FOR_EACH)
- **Iteration Count:** (For COUNT) Number of times to loop (e.g. `5`).
- **Array JSONPath Source:** (For FOR_EACH) Path to a collection array in the context (e.g. `$.users` or `{{userList}}`).

#### Real-world Example
- **Type:** `Fixed Count Iterations`
- **Iteration Count:** `3`

---

### Log Message
Prints message streams to the runner debug console. Helpful for diagnostic validation.

#### Configuration Parameters
- **Level:** `INFO` | `WARN` | `DEBUG`
- **Log Message:** Message payload (supports variable interpolation, e.g. `Retrieved user ID: {{userId}}`).

#### Real-world Example
- **Level:** `INFO`
- **Message:** `Successfully parsed token: {{userToken}}`

---

### Custom Script
Evaluates JavaScript expressions to manipulate headers, compute checksums, or run logic.

#### Configuration Parameters
- **Script Context:** Raw JavaScript statements. Accesses context variables natively.

#### Real-world Example
Generating a dynamic timestamp parameter:
- **Script:**
  ```javascript
  context.timestamp = new Date().toISOString();
  context.signature = btoa(context.apiKey + context.timestamp);
  ```

---

### Parallel Group
Runs multiple HTTP Request, Delay, or Log steps concurrently in parallel threads to test performance or simulate parallel async operations.

#### Configuration Parameters
- **Steps:** Add one or more sub-steps:
  - Sub-step name & type (`HTTP Request`, `Delay/Pause`, `Log Message`).
  - Configurations relative to that step type.

#### Real-world Example
Simulating three simultaneous user requests:
- **Parallel Sub-step 1:** `GET {{baseUrl}}/api/items`
- **Parallel Sub-step 2:** `GET {{baseUrl}}/api/categories`
- **Parallel Sub-step 3:** `GET {{baseUrl}}/api/brands`

---

### Reusable Global Step Template
References a shared global template configured by workspace administrators. Excellent for standard actions like authentication handshakes.

#### Configuration Parameters
- **Step Reference Selection:** Chosen from a repository of global test steps.

#### Real-world Example
- **Reference:** `Global - OKTA Login Session` (executes login, sets headers, and updates auth variables automatically).
