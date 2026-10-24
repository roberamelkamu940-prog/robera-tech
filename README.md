# 🚀 Robera Tech | Next-Gen E-Learning Platform

Robera Tech is a robust, production-grade e-learning web application built with **Node.js, Express, EJS, and MySQL**, integrated with secure **Chapa payment processing** and enterprise-level DevOps standards.

---

## 🛠️ Tech Stack
* **Backend:** Node.js, Express.js, Express-Session, Express-MySQL-Session
* **Database:** MySQL 8.0 (with connection pooling & atomic SQL transactions)
* **Frontend:** EJS Templating Engine, Tailwind CSS, FontAwesome
* **Security:** Helmet.js, Express-Rate-Limit, CSRF/XSS defenses
* **Payments:** Chapa API (with secure webhook listeners and background verification)
* **DevOps:** Docker, Docker Compose, PM2 Cluster Management

---

## 📁 Project Structure
```text
robera-tech/
├── config/
│   └── db.js              # MySQL connection pool configuration
├── middleware/
│   └── errorHandler.js    # Global centralized error handler
├── routes/
│   ├── authRoutes.js      # Authentication (Login/Register)
│   ├── studentRoutes.js   # Student dashboard & course catalog
│   ├── adminRoutes.js     # Admin management panels
│   └── webhookRoutes.js   # Secure Chapa payment webhooks
├── views/
│   ├── student/           # Student dashboards & classrooms
│   ├── auth/              # Login and registration pages
│   └── error.ejs          # Professional error view
├── public/                # Static assets (CSS, JS, images)
├── .env.example           # Environment variables template
├── Dockerfile             # Container definition
├── docker-compose.yml     # Multi-container orchestration
├── ecosystem.config.js    # PM2 production configuration
├── server.js              # Application entry point
└── package.json           # Dependencies and scripts

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`, then set the MySQL connection values and a long random `SESSION_SECRET`. Keep `.env` private.
3. Create the database and initial tables with `database/schema.sql` for a fresh installation.
4. For an existing installation, back up the database and manually apply `database/migrations/001_tutorial_features.sql`. The migration only adds columns/tables; it does not drop or truncate data. It requires a MySQL 8.0 release that supports `ADD COLUMN IF NOT EXISTS`.
5. Set `APP_BASE_URL` to the public HTTPS origin when deployed. Paid course enrollment additionally requires a valid `CHAPA_SECRET_KEY`.
6. Start the app with `npm start` or `npm run dev`.

The project currently has no automated test script. The implementation can be syntax-checked with `node --check` and EJS templates can be compiled locally; database-backed workflows require a configured MySQL service. Payment checkout also requires valid Chapa credentials and cannot be verified offline.

## Existing Features

Student accounts can browse courses, enroll in free courses, access enrolled course lessons, track lesson completion, and submit quizzes. Administrators can review platform counts, create courses and lessons, manage quizzes, and view student enrollment counts. Course and lesson management does not include deletion actions.