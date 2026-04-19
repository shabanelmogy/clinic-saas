import "./config/env.js"; // validate env vars first — must be first import

import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { pinoHttp } from "pino-http";
import type { IncomingMessage } from "http";

import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { swaggerSpec } from "./config/swagger.js";
import { globalRateLimiter } from "./config/rate-limit.js";
import { requestId } from "./middlewares/request-id.middleware.js";
import { i18nMiddleware } from "./utils/i18n.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { checkDbConnection } from "./utils/db-health.js";
import { closeDb } from "./db/index.js";

import authRoutes from "./modules/auth/auth.routes.js";
import staffUserRoutes from "./modules/staff-users/staff-user.routes.js";
import appointmentRoutes from "./modules/appointments/appointment.routes.js";
import clinicRoutes from "./modules/clinics/clinic.routes.js";
import doctorRoutes, { publicDoctorRouter } from "./modules/doctors/doctor.routes.js";
import doctorScheduleRoutes, { publicScheduleRouter } from "./modules/doctor-schedules/doctor-schedule.routes.js";
import patientRoutes from "./modules/patients/patient.routes.js";
import slotTimeRoutes from "./modules/slot-times/slot-time.routes.js";
import roleRoutes from "./modules/rbac/role.routes.js";
import patientRequestRoutes from "./modules/patient-requests/patient-request.routes.js";
import doctorRequestRoutes from "./modules/doctor-requests/doctor-request.routes.js";

const app = express();

// ─── Request ID (first — everything else can log it) ─────────────────────────
app.use(requestId);

// ─── i18n (second — detect language from headers) ────────────────────────────
app.use(i18nMiddleware);

// ─── Structured HTTP Logging ──────────────────────────────────────────────────
if (env.NODE_ENV !== "test") {
  app.use(
    pinoHttp({
      logger,
      customProps: (req: IncomingMessage) => ({ reqId: (req as express.Request).id }),
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === "/health" || req.url === "/api/v1/health",
      },
    })
  );
}

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
      },
    },
  })
);
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use("/api/", globalRateLimiter);

// ─── Swagger Docs ─────────────────────────────────────────────────────────────
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Clinic SaaS API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  })
);

app.get("/api/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ─── Health Check ─────────────────────────────────────────────────────────────
/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     description: Returns server and database status with latency.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 db: { type: object }
 *                 timestamp: { type: string, format: date-time }
 *       503:
 *         description: Database is unreachable
 */
const healthHandler = async (_req: express.Request, res: express.Response) => {
  const dbHealth = await checkDbConnection();
  const status = dbHealth.connected ? 200 : 503;
  res.status(status).json({
    status: dbHealth.connected ? "ok" : "degraded",
    db: dbHealth,
    timestamp: new Date().toISOString(),
  });
};

// Available at both paths — /health for infra probes, /api/v1/health for API consumers
app.get("/health", healthHandler);
app.get("/api/v1/health", healthHandler);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/staff-users", staffUserRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/clinics", clinicRoutes);
// Public marketplace: /api/v1/clinics/:clinicId/doctors
// ✅ Mount on static prefix — param :clinicId is defined inside publicDoctorRouter
app.use("/api/v1/clinics", publicDoctorRouter);
// Public: /api/v1/clinics/:clinicId/doctors/:doctorId/schedules
app.use("/api/v1/clinics", publicScheduleRouter);
// Staff: /api/v1/doctors (scoped to JWT clinicId)
app.use("/api/v1/doctors", doctorRoutes);
// Staff: /api/v1/doctors/:doctorId/schedules
// ✅ Mount on static prefix — param :doctorId defined inside doctorScheduleRoutes
app.use("/api/v1/doctors", doctorScheduleRoutes);
app.use("/api/v1/patients", patientRoutes);
app.use("/api/v1/slot-times", slotTimeRoutes);
app.use("/api/v1/roles", roleRoutes);
// Patient requests: public POST + staff review
app.use("/api/v1/patient-requests", patientRequestRoutes);
// Doctor requests: public POST + staff review
app.use("/api/v1/doctor-requests", doctorRequestRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start + Graceful Shutdown ────────────────────────────────────────────────
const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`📚 Swagger UI   → http://localhost:${env.PORT}/api/docs`);
  logger.info(`📄 OpenAPI JSON → http://localhost:${env.PORT}/api/docs.json`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    logger.info("HTTP server closed");
    await closeDb();
    process.exit(0);
  });

  // Force exit if connections don't drain within 10s
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

export default app;
