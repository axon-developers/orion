# ORION — Visual Test Execution & Orchestration Platform

ORION is a premium, high-performance visual test design and execution orchestration suite. It features a sleek, responsive dark/light mode dashboard for visual workflow creation, custom execution variables management, database integration, client SSL/TLS certificate configuration (mTLS), and real-time step-by-step execution metrics.

---

## 🚀 Key Features

* **Visual Test Case Designer**: Drag, drop, and configure workflow execution nodes sequentially. Test steps are logically categorized into:
  * **Primary Steps:** Interface with external systems (`HTTP_REQUEST`, `SOAP_REQUEST`, `DATABASE_QUERY`, `BROWSER_AUTOMATION`).
  * **Support Steps:** Validate results or extract variables (`ASSERTION`, `SET_VARIABLE`).
  * **Display Steps:** Focus on output and debugging (`LOG`, `DB_TABLE_VIEW`).
  * **Technical Steps:** Manage flow control and orchestration (`DELAY`, `CONDITIONAL`, `LOOP`, `SCRIPT`, `PARALLEL`, `GLOBAL_REF`).
* **Variable Interpolation**: Dynamically inject variables saved from previous execution steps or environment definitions across request URLs, headers, payloads, and SQL queries using the `{{variableName}}` syntax.
* **Parallel Execution Engine**: Run multiple sub-steps concurrently (e.g., parallel HTTP requests) leveraging the backend's virtual thread execution model.
* **Environment Variables & Databases Drawer**: An expanded configuration drawer supporting tabular alignment of variables, database connections (JDBC), and secret toggles.
* **SSL/TLS & Mutual Authentication (mTLS)**: Upload keystores (`.p12`/`.pfx`) and assign certificates directly to environments for secure HTTP testing.
* **Real-time Executions Log**: Renders live step execution logs and outputs, providing immediate feedback on step duration, input/output payloads, and failure states.

---

## 🛠️ Project Structure & Architecture

The project is structured as a monorepo consisting of:

* **/orion-backend**: A Spring Boot 3.3 Java application featuring:
  * **Execution Engine:** A robust, multi-protocol execution engine utilizing the Strategy pattern (`StepExecutor`) to handle various step types.
  * **Database:** Uses SQLite by default for development (with support for PostgreSQL in production). 
  * **Auth:** Configured with JJWT authentication and standard Spring Security.
  * **Persistence:** JPA/Hibernate mappings with Flyway migrations.
* **/orion-frontend**: A modern React 18 + TypeScript client built with:
  * **Build Tool:** Vite for fast HMR and optimized builds.
  * **Styling:** Tailwind CSS with a custom design system and Radix/Lucide icons.
  * **State Management:** Zustand for global stores (e.g., workflow store) and TanStack React Query for server state and caching.
  * **Modular Configs:** Form components are decoupled into a dedicated `step-configs/` directory for maintainability.

---

## ⚙️ Prerequisites

Before launching the project, ensure you have the following installed:
* **Java 21+** (Tested with Java 26 compatibility)
* **Apache Maven**
* **Node.js** (v18+)
* **SQLite** (Bundled automatically as local file database)

---

## 🚀 Getting Started

### 1. Database Setup & Reset
To ensure all database schemas are initialized correctly, delete any stale database files to trigger fresh Flyway migrations:
```powershell
# From the project root
Remove-Item -Path "orion-backend/orion.db" -ErrorAction SilentlyContinue
```

### 2. Run the Spring Boot Backend
Start the Java backend application on port `8080`:
```bash
cd orion-backend
mvn clean compile
mvn spring-boot:run
```

### 3. Run the Frontend Dev Client
Install dependencies and run the Vite server locally on port `5173`:
```bash
cd orion-frontend
npm install
npm run dev
```

---

## 🔐 Authentication & Roles

Log in using the default administrative credentials. (The system dynamically updates or seeds the system administrator password to default on every backend startup).
* **Username**: `admin`
* **Password**: `Admin@123`

The system automatically initializes three standard user roles:
1. `ADMIN` — Full execution, database configurations, and user management authority.
2. `TESTER` / `EDITOR` — Can configure applications, design workflow steps, and execute tests.
3. `VIEWER` — Read-only dashboard access. Environment drawer fields and edit options are disabled.
