import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    env: env.NODE_ENV,
    service: "clinic-api",
  },
  ...(env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  ...(env.NODE_ENV === "production" && {
    // Structured JSON in production — ship to log aggregator
    redact: {
      paths: [
        // Headers
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers['x-api-key']",
        // Request body - specific fields
        "req.body.password",
        "req.body.passwordHash",
        "req.body.token",
        "req.body.refreshToken",
        "req.body.accessToken",
        "req.body.apiKey",
        "req.body.secret",
        // Wildcard patterns - any nested field with these names
        "*.password",
        "*.passwordHash",
        "*.token",
        "*.refreshToken",
        "*.accessToken",
        "*.apiKey",
        "*.secret",
        "*.authorization",
      ],
      censor: "[REDACTED]",
    },
  }),
});

export type Logger = typeof logger;
