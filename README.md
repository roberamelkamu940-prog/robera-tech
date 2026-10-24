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