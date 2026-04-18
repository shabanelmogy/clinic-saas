import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Clinic SaaS API",
      version: "1.0.0",
      description:
        "Production-ready REST API for the Clinic SaaS platform. Manages users and appointments.",
      contact: {
        name: "API Support",
        email: "support@clinicsaas.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/v1`,
        description: "Development server",
      },
      {
        url: "https://api.clinicsaas.com/api/v1",
        description: "Production server",
      },
    ],
    tags: [
      { name: "Health", description: "Server health check" },
      { name: "Auth", description: "Authentication — login, refresh, current user" },
      { name: "Users", description: "User management endpoints" },
      { name: "Appointments", description: "Appointment management endpoints" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your access token from POST /auth/login",
        },
      },
      schemas: {
        // ── Enums ──────────────────────────────────────────────────────────
        UserRole: {
          type: "string",
          enum: ["admin", "user", "guest"],
          example: "user",
        },
        AppointmentStatus: {
          type: "string",
          enum: ["pending", "confirmed", "cancelled", "completed"],
          example: "pending",
        },

        // ── User ───────────────────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
            name: { type: "string", example: "Jane Doe" },
            email: { type: "string", format: "email", example: "jane@example.com" },
            role: { $ref: "#/components/schemas/UserRole" },
            isActive: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateUserBody: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", minLength: 2, maxLength: 100, example: "Jane Doe" },
            email: { type: "string", format: "email", example: "jane@example.com" },
            password: {
              type: "string",
              minLength: 8,
              maxLength: 72,
              description: "Must contain at least one uppercase letter and one number",
              example: "SecurePass1",
            },
            role: { $ref: "#/components/schemas/UserRole" },
          },
        },
        UpdateUserBody: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 2, maxLength: 100, example: "Jane Smith" },
            email: { type: "string", format: "email", example: "jane.smith@example.com" },
            role: { $ref: "#/components/schemas/UserRole" },
            isActive: { type: "boolean", example: false },
          },
        },

        // ── Appointment ────────────────────────────────────────────────────
        Appointment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", example: "660e8400-e29b-41d4-a716-446655440001" },
            userId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
            title: { type: "string", example: "Initial Consultation" },
            description: { type: "string", nullable: true, example: "First meeting with the client" },
            scheduledAt: { type: "string", format: "date-time", example: "2026-06-15T10:00:00Z" },
            durationMinutes: { type: "integer", example: 60 },
            status: { $ref: "#/components/schemas/AppointmentStatus" },
            notes: { type: "string", nullable: true, example: "Bring portfolio" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateAppointmentBody: {
          type: "object",
          required: ["userId", "title", "scheduledAt"],
          properties: {
            userId: { type: "string", format: "uuid", example: "550e8400-e29b-41d4-a716-446655440000" },
            title: { type: "string", minLength: 2, maxLength: 200, example: "Initial Consultation" },
            description: { type: "string", maxLength: 1000, example: "First meeting with the client" },
            scheduledAt: {
              type: "string",
              format: "date-time",
              description: "Must be a future ISO 8601 datetime",
              example: "2026-06-15T10:00:00Z",
            },
            durationMinutes: { type: "integer", minimum: 5, maximum: 480, default: 60, example: 60 },
            notes: { type: "string", maxLength: 2000, example: "Bring portfolio" },
          },
        },
        UpdateAppointmentBody: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 2, maxLength: 200, example: "Follow-up Consultation" },
            description: { type: "string", maxLength: 1000 },
            scheduledAt: { type: "string", format: "date-time", example: "2026-07-01T14:00:00Z" },
            durationMinutes: { type: "integer", minimum: 5, maximum: 480 },
            status: { $ref: "#/components/schemas/AppointmentStatus" },
            notes: { type: "string", maxLength: 2000 },
          },
        },

        // ── Responses ──────────────────────────────────────────────────────
        PaginationMeta: {
          type: "object",
          properties: {
            total: { type: "integer", example: 42 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 },
            totalPages: { type: "integer", example: 3 },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Validation failed" },
            errors: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: { type: "string" },
              },
              example: {
                "body.email": ["Invalid email address"],
                "body.password": ["Password must contain at least one uppercase letter"],
              },
            },
          },
        },
        NotFoundError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "User not found" },
          },
        },
        ConflictError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "A user with that email already exists" },
          },
        },
      },
      parameters: {
        IdParam: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          example: "550e8400-e29b-41d4-a716-446655440000",
        },
        PageParam: {
          name: "page",
          in: "query",
          schema: { type: "integer", minimum: 1, default: 1 },
        },
        LimitParam: {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  },
  // Scan these files for JSDoc @openapi annotations
  apis: ["./src/modules/**/*.routes.ts", "./src/server.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
