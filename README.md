# Clinic SaaS

A production-ready healthcare SaaS platform with multi-tenant clinic management, marketplace booking, and role-based access control.

## Stack

| Layer | Tech |
|---|---|
| API | Node.js · TypeScript · Express · Drizzle ORM · PostgreSQL |
| Frontend | Next.js 16 · TypeScript · Tailwind CSS · shadcn/ui · React Query · Zustand |
| Auth | JWT (access + refresh tokens) · RBAC |
| i18n | next-intl (English + Arabic / RTL) |

## Project Structure

```
clinic-saas/
├── api/        ← Express REST API
└── web/        ← Next.js frontend
```

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (or [Neon](https://neon.tech) serverless)

### API

```bash
cd api
cp .env.example .env        # fill in DATABASE_URL and JWT secrets
npm install
npm run db:migrate           # apply migrations
npm run seed:dev             # seed dev data
npm run dev                  # starts on :3000
```

Swagger UI: `http://localhost:3000/api/docs`

### Frontend

```bash
cd web
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL
npm install
npm run dev                  # starts on :3001
```

## Dev Credentials (after seed)

| Role | Email | Password |
|---|---|---|
| Super Admin | super@clinicsaas.com | SuperAdmin1 |
| Clinic Admin | alice@cityhealth.com | ClinicAdmin1 |
| Doctor | sarah.smith@cityhealth.com | Doctor1234! |
| Receptionist | emma@cityhealth.com | Reception1! |

> Login tip: Super Admin logs in without `clinicId`. Clinic staff must include their `clinicId` in the login body.

## API Modules

- **Auth** — JWT login, refresh, logout, change password
- **Staff Users** — CRUD with RBAC
- **Clinics** — Multi-tenant clinic management
- **Doctors** — Clinic-owned doctor profiles + schedules
- **Patients** — Global patient registry (no clinic lock-in)
- **Appointments** — Slot-based + walk-in booking with optimistic locking
- **Slots** — Generated from schedule rules, atomic booking
- **Roles & Permissions** — Full RBAC with 32 permissions
- **Patient Requests** — Public registration workflow
- **Doctor Requests** — Join clinic or create new clinic workflow

## Environment Variables

See `api/.env.example` and `web/.env.example`.
