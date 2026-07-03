# ORION — Visual Test Execution & Orchestration Platform

ORION is a premium, high-performance visual test design and execution orchestration suite. It features a sleek, responsive dark/light mode dashboard for visual workflow creation, custom execution variables management, client SSL/TLS certificate configuration (mTLS), and real-time step-by-step execution metrics.

---

## 🚀 Key Features

* **Visual Test Case Designer**: Drag, drop, and configure workflow execution nodes (HTTP Requests, assertions, database queries, delay timers, runtime extraction variables, and scripts) sequentially.
* **Environment Variables Drawer**: An expanded slide-over configuration drawer supporting horizontal tabular alignment of keys, values, secret toggle views, and description logs. Enforces custom alphanumeric underscore validations.
* **SSL/TLS & Mutual Authentication (mTLS)**: Upload `.p12`/`.pfx` keystores directly through the UI, set passwords, and enable TLS client authentication on HTTP test steps. Includes a toggle to bypass validation (useful for self-signed certificates in local environments).
* **Self-Healing Admin Initialization**: Dynamically updates or seeds the system administrator password to default (`admin` / `Admin@123`) on every backend startup.
* **Header Actions**: Features a stateful Dark/Light mode toggle, dynamic pathname breadcrumbs, and an interactive profile actions dropdown with secure logout redirection.
* **Real-time Executions Log**: Renders live step execution logs and outputs powered by Server-Sent Events (SSE).
* **Compact Registry Cards**: Minimizes home dashboard app grids into sleek, fixed-height cards (`h-[155px]`) with action buttons visible only on hover.

---

## 🛠️ Project Structure

The project is structured as a monorepo consisting of:
* **/orion-backend**: Spring Boot 3 Java application configured with JJWT authentication, JPA/Hibernate mappings, Flyway migrations, and a multi-protocol Step Execution Engine.
* **/orion-frontend**: React + TypeScript client built with Vite, Tailwind CSS, Zustand, TanStack React Query, and Lucide icon packs.

---

## ⚙️ Prerequisites

Before launching the project, ensure you have the following installed:
* **Java 26** (or compatible JDK)
* **Apache Maven** (tested with maven compiler plugin compatibility)
* **Node.js** (v18+)
* **SQLite** (bundled automatically as local file database)

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

Log in using the default administrative credentials:
* **Username**: `admin`
* **Password**: `Admin@123`

The system automatically initializes three standard user roles:
1. `ADMIN` — Full execution, database configurations, and user management authority.
2. `EDITOR` — Can configure applications, design workflow steps, and execute tests.
3. `VIEWER` — Read-only dashboard access. Environment drawer fields and edit options are disabled.
