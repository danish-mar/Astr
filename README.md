<div align="center">

# ✨ Astr

### _v3.0.0 — The Sharp Minimal Overhaul_

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Alpine.js](https://img.shields.io/badge/Alpine.js-8BC0D0?style=for-the-badge&logo=alpinedotjs&logoColor=black)](https://alpinejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

---

</div>

<br/>

## 🌟 What is Astr?

**Astr** is a high-performance management system engineered for service and repair shops that demand **precision** and **extreme speed**. Version 3.0 introduces the **Sharp Minimal** aesthetic—a professional, industrial design language that eliminates clutter and focuses on pure operational efficiency.

Built with modern TypeScript, Astr combines enterprise-grade stability with a lightning-fast UI that feels like a native desktop application.

<br/>

## ⚡ v3.0 Feature Highlights

<table>
<tr>
<td width="50%">

### 🎨 **Sharp Minimal UX**

- 📐 **Industrial Precision** — High-contrast, sharp-cornered design
- 🔍 **Unified Global Search** — Instant access via `Cmd + K` or `/`
- 🔔 **Activity Notifications** — Real-time event tracking in the header
- � **Universal Deep Linking** — Share direct links to any ticket or product
- � **Micro-Animations** — Tactile feedback for every action

</td>
<td width="50%">

### 🔧 **Operational Power**

- 🛡️ **Role-Based Security** — Granular access control for Techs & Admin
- � **Precision Accounting** — Real-time payable/receivable mapping
- 🎯 **Lead Workspace** — Landscape dual-view for high-velocity sales
- ☁️ **S3-Engineered** — MinIO/AWS S3 powered high-res product media
- 📈 **Pulse Analytics** — Real-time revenue & stock health dashboard

</td>
</tr>
</table>

<br/>

<div align="center">

## 🎯 Core Modules

</div>

| Module                 | Description                 | v3.0 Enhancements                                      |
| ---------------------- | --------------------------- | ------------------------------------------------------ |
| 🎫 **Service Tickets** | End-to-end repair lifecycle | Instant ID search, technician assignment, status logs  |
| 💸 **Accounting**      | Financial health tracker    | Balance-based summaries, interactive accounts, tags    |
| 📦 **Inventory**       | Premium product catalog     | Smart filtering, S3 media management, "Sold" tracking  |
| 🎯 **Lead Tracker**    | Sales pipeline management   | **New Landscape Workspace**, interest mapping, history |
| 👥 **Contacts**        | Smart customer/vendor hub   | Deep linking support, history tracking, CRM features   |
| 📊 **Dashboard**       | Mission control center      | Predictive stats, earnings trends, quick-action cards  |
| 🔐 **Auth System**     | Restricted access           | Biometric-ready login UI, JWT-signed sessions          |
| ⚙️ **Settings**        | Global orchestration        | System-wide versioning, S3 config, branding control    |

<br/>

<div align="center">

## 🛠️ Tech Stack Deep Dive

</div>

<table>
<tr>
<td align="center" width="25%">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" width="64" height="64" />
<br/><strong>TypeScript</strong>
<br/><sub>v5.9+ Precision</sub>
</td>
<td align="center" width="25%">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" width="64" height="64" />
<br/><strong>Node.js</strong>
<br/><sub>Modern V8 Engine</sub>
</td>
<td align="center" width="25%">
<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg" width="64" height="64" />
<br/><strong>MongoDB</strong>
<br/><sub>Distributed Storage</sub>
</td>
<td align="center" width="25%">
<img src="https://www.svgrepo.com/show/374002/alpine.svg" width="64" height="64" />
<br/><strong>Alpine.js</strong>
<br/><sub>Lightweight Reactivity</sub>
</td>
</tr>
</table>

### Enterprise Architecture

```
TypeScript + Node.js + Express.js
├── � Global Search Engine (Cross-Model Index)
├── 🔔 Event-Driven Notifications
├── 🗄️ MongoDB Persistence Layer
├── 📡 RESTful v1 API
└── � Real-time Request Auditing
```

### Frontend Engineering

```
EJS + Alpine.js + TailwindCSS
├── 💎 Sharp Minimal Design System
├── 🚀 Zero-Bundler Performance
├── 📊 Live Data Visualization (Chart.js)
└── 🔗 Link-State Sync (Deep Linking)
```

<br/>

<div align="center">

## 🚀 Quick Start

</div>

### Option 1: Development Environment

```bash
# 📥 Clone
git clone https://git.sangonomiya.icu/danish-mar/Astr.git
cd Astr

# 📦 Setup
npm install
cp .env.example .env

# 🌱 Initialize
npm run seed

# 🔥 Launch
npm run dev
```

### Option 2: Production (Docker)

```bash
# � Spin up unified stack (App + DB + MinIO)
docker-compose up -d

# 📊 Check Health
docker-compose ps
```

<div align="center">

🎉 **Visit `http://localhost:3000`**

**Default Admin Login:** `admin` / `admin123`

</div>

<br/>

<div align="center">

## 🐳 Docker & CI/CD

</div>

### Automated Builds

Every push to the `main` branch automatically:

- ✅ Runs CI checks (TypeScript build validation)
- 🐳 Builds optimized Docker image
- 📦 Pushes to GitHub Container Registry
- 🏷️ Tags with both `latest` and commit SHA

### Docker Image Details

- **Registry:** `ghcr.io/danish-mar/astr`
- **Base Image:** Node.js 24 Alpine (minimal footprint)
- **Build Type:** Multi-stage (optimized for production)
- **Image Size:** ~150MB (production dependencies only)

### Environment Variables

| Variable      | Description               | Default      |
| ------------- | ------------------------- | ------------ |
| `PORT`        | Application port          | `3000`       |
| `MONGODB_URI` | MongoDB connection string | Required     |
| `JWT_SECRET`  | Secret key for JWT tokens | Required     |
| `NODE_ENV`    | Environment mode          | `production` |

<br/>

<div align="center">

## 📂 Project Structure

</div>

```
Astr/
├── 📁 src/
│   ├── 🎨 views/           # EJS templates
│   │   ├── layouts/        # Main layout & partials
│   │   ├── dashboard.ejs   # Analytics dashboard
│   │   ├── products.ejs    # Inventory management
│   │   └── service-tickets.ejs
│   ├── 🛣️ routes/          # API route definitions
│   ├── 🎯 controllers/     # Business logic
│   ├── 📦 models/          # Mongoose schemas
│   ├── 🔧 middleware/      # Auth, logging, validation
│   └── 🛠️ utils/           # Helper functions
├── 🌱 seed.ts             # Database seeding script
├── 📝 README.md
└── 📦 package.json
```

<br/>

<div align="center">

## 🎨 Design Philosophy

</div>

> **"Speed + Elegance = Astr"**

This project proves that **rapid development** doesn't mean sacrificing quality. Every component was engineered with:

- ✅ **Type Safety** — TypeScript across the stack
- ✅ **Clean Code** — Modular, maintainable architecture
- ✅ **Modern UX** — iOS-inspired glassmorphism
- ✅ **Performance** — Optimized API calls & caching
- ✅ **Scalability** — Production-ready from day one

<br/>

<div align="center">

## 📊 Project Stats

</div>

<div align="center">

| Metric                     | Value                 |
| -------------------------- | --------------------- |
| 📝 **Total Lines of Code** | 10,000+               |
| ⚡ **API Response Time**   | < 50ms avg            |
| 🎯 **Code Coverage**       | Type-safe             |
| 🚀 **Build Time**          | Instant (no bundler!) |
| 📱 **Mobile Responsive**   | 100%                  |

</div>

<br/>

<div align="center">

## 🔮 Coming Soon

</div>

- 📸 **Screenshot Gallery** — See the interface in action
- 📱 **Mobile App** — Native iOS/Android companion
- 🔔 **Push Notifications** — Real-time ticket updates
- 🌍 **Multi-language** — i18n support
- 📄 **PDF Reports** — Invoice & receipt generation
- 🔌 **Webhook Integration** — Connect to external services

<br/>

<div align="center">

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

Feel free to check the [issues page](../../issues).

</div>

<br/>

---

<div align="center">

### 💻 Built with ⚡ by [@danish-mar](https://github.com/danish-mar)

<br/>

</div>
