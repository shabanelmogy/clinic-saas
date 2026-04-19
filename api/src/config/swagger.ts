import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

// ─── Server list ──────────────────────────────────────────────────────────────

const servers = [
  {
    url: `http://localhost:${env.PORT}/api/v1`,
    description: "Local development",
  },
];

if (env.API_URL) {
  servers.push({
    url: `${env.API_URL}/api/v1`,
    description: "Production",
  });
}

// ─── Spec ─────────────────────────────────────────────────────────────────────

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Clinic SaaS API",
      version: "1.0.0",
      description:
        "Multi-tenant healthcare SaaS REST API. " +
        "Manages staff users, patients, doctors, appointments, scheduling, and RBAC.",
      contact: {
        name: "API Support",
        email: "support@clinicsaas.com",
      },
    },
    servers,

    // ── Tags ──────────────────────────────────────────────────────────────────
    tags: [
      { name: "Health",           description: "Server and database health check" },
      { name: "Auth",             description: "Login, token rotation, logout, change password" },
      { name: "StaffUsers",       description: "Staff user management (admin, doctor, receptionist)" },
      { name: "Clinics",          description: "Clinic management and marketplace listing" },
      { name: "Patients",         description: "Patient records (clinic-owned)" },
      { name: "Doctors",          description: "Doctor profiles (clinic-owned)" },
      { name: "DoctorSchedules",  description: "Weekly recurring availability rules" },
      { name: "SlotTimes",        description: "Generated bookable time slots" },
      { name: "Appointments",     description: "Appointment booking and management" },
      { name: "Roles",            description: "Role and permission management (RBAC)" },
    ],

    components: {
      // ── Security ─────────────────────────────────────────────────────────
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Obtain a token from `POST /auth/login`. " +
            "Include as `Authorization: Bearer <token>` on protected routes.",
        },
      },

      // ── Reusable schemas ──────────────────────────────────────────────────
      schemas: {
        // ── Enums ────────────────────────────────────────────────────────
        AppointmentStatus: {
          type: "string",
          enum: ["pending", "confirmed", "cancelled", "completed", "no_show"],
          example: "pending",
        },
        SlotStatus: {
          type: "string",
          enum: ["available", "booked", "blocked"],
          example: "available",
        },
        DayOfWeek: {
          type: "string",
          enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
          example: "monday",
        },
        DoctorSpecialty: {
          type: "string",
          enum: [
            "general_practice", "cardiology", "dermatology", "endocrinology",
            "gastroenterology", "gynecology", "hematology", "nephrology",
            "neurology", "oncology", "ophthalmology", "orthopedics",
            "otolaryngology", "pediatrics", "psychiatry", "pulmonology",
            "radiology", "rheumatology", "surgery", "urology", "other",
          ],
          example: "cardiology",
        },
        PatientGender: {
          type: "string",
          enum: ["male", "female", "other"],
          example: "female",
        },
        PatientBloodType: {
          type: "string",
          enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
          example: "O+",
        },

        // ── Staff User ────────────────────────────────────────────────────
        StaffUser: {
          type: "object",
          properties: {
            id:        { type: "string", format: "uuid" },
            name:      { type: "string", example: "Dr. Jane Smith" },
            email:     { type: "string", format: "email", example: "jane@clinic.com" },
            phone:     { type: "string", nullable: true, example: "+1-555-0100" },
            isActive:  { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        // ── Clinic ────────────────────────────────────────────────────────
        Clinic: {
          type: "object",
          properties: {
            id:          { type: "string", format: "uuid" },
            name:        { type: "string", example: "City Health Clinic" },
            slug:        { type: "string", example: "city-health-clinic" },
            description: { type: "string", nullable: true },
            address:     { type: "string", nullable: true },
            phone:       { type: "string", nullable: true },
            email:       { type: "string", nullable: true },
            website:     { type: "string", nullable: true },
            logo:        { type: "string", nullable: true },
          },
        },

        // ── Patient ───────────────────────────────────────────────────────
        Patient: {
          type: "object",
          properties: {
            id:           { type: "string", format: "uuid" },
            clinicId:     { type: "string", format: "uuid" },
            name:         { type: "string", example: "John Doe" },
            phone:        { type: "string", nullable: true },
            email:        { type: "string", nullable: true },
            dateOfBirth:  { type: "string", format: "date", nullable: true },
            gender:       { $ref: "#/components/schemas/PatientGender", nullable: true },
            bloodType:    { $ref: "#/components/schemas/PatientBloodType", nullable: true },
            isActive:     { type: "boolean", example: true },
            createdAt:    { type: "string", format: "date-time" },
            updatedAt:    { type: "string", format: "date-time" },
          },
        },

        // ── Doctor ────────────────────────────────────────────────────────
        Doctor: {
          type: "object",
          properties: {
            id:               { type: "string", format: "uuid" },
            clinicId:         { type: "string", format: "uuid" },
            name:             { type: "string", example: "Dr. Sarah Lee" },
            specialty:        { $ref: "#/components/schemas/DoctorSpecialty" },
            bio:              { type: "string", nullable: true },
            avatar:           { type: "string", nullable: true },
            experienceYears:  { type: "integer", nullable: true, example: 10 },
            consultationFee:  { type: "integer", nullable: true, example: 5000, description: "In cents" },
            isActive:         { type: "boolean", example: true },
            isPublished:      { type: "boolean", example: true },
          },
        },

        // ── Appointment ───────────────────────────────────────────────────
        Appointment: {
          type: "object",
          properties: {
            id:              { type: "string", format: "uuid" },
            clinicId:        { type: "string", format: "uuid" },
            patientId:       { type: "string", format: "uuid" },
            doctorId:        { type: "string", format: "uuid", nullable: true },
            title:           { type: "string", example: "Initial Consultation" },
            scheduledAt:     { type: "string", format: "date-time" },
            durationMinutes: { type: "integer", example: 60 },
            status:          { $ref: "#/components/schemas/AppointmentStatus" },
            notes:           { type: "string", nullable: true },
            createdAt:       { type: "string", format: "date-time" },
            updatedAt:       { type: "string", format: "date-time" },
          },
        },

        // ── Slot Time ─────────────────────────────────────────────────────
        SlotTime: {
          type: "object",
          properties: {
            id:            { type: "string", format: "uuid" },
            clinicId:      { type: "string", format: "uuid" },
            doctorId:      { type: "string", format: "uuid" },
            startTime:     { type: "string", format: "date-time" },
            endTime:       { type: "string", format: "date-time" },
            status:        { $ref: "#/components/schemas/SlotStatus" },
            appointmentId: { type: "string", format: "uuid", nullable: true },
            createdAt:     { type: "string", format: "date-time" },
          },
        },

        // ── Role & Permission ─────────────────────────────────────────────
        Permission: {
          type: "object",
          properties: {
            id:          { type: "string", format: "uuid" },
            key:         { type: "string", example: "appointments:create" },
            name:        { type: "string", example: "Create Appointments" },
            description: { type: "string", nullable: true },
            category:    { type: "string", example: "appointments" },
            createdAt:   { type: "string", format: "date-time" },
          },
        },
        Role: {
          type: "object",
          properties: {
            id:          { type: "string", format: "uuid" },
            name:        { type: "string", example: "Receptionist" },
            description: { type: "string", nullable: true },
            clinicId:    { type: "string", format: "uuid", nullable: true, description: "null = global role" },
            createdAt:   { type: "string", format: "date-time" },
            updatedAt:   { type: "string", format: "date-time" },
          },
        },
        RoleWithPermissions: {
          allOf: [
            { $ref: "#/components/schemas/Role" },
            {
              type: "object",
              properties: {
                permissions: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Permission" },
                },
              },
            },
          ],
        },

        // ── Shared response shapes ────────────────────────────────────────
        PaginationMeta: {
          type: "object",
          properties: {
            total:      { type: "integer", example: 42 },
            page:       { type: "integer", example: 1 },
            limit:      { type: "integer", example: 20 },
            totalPages: { type: "integer", example: 3 },
            hasNextPage: { type: "boolean", example: true },
            hasPrevPage: { type: "boolean", example: false },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Validation failed" },
            errors: {
              type: "object",
              additionalProperties: { type: "array", items: { type: "string" } },
              example: { "body.email": ["Invalid email address"] },
            },
          },
        },
        NotFoundError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Resource not found" },
          },
        },
        ConflictError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Resource already exists" },
          },
        },
        UnauthorizedError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Invalid or expired access token" },
          },
        },
        ForbiddenError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Permission 'patients:view' is required" },
          },
        },
      },

      // ── Reusable parameters ───────────────────────────────────────────────
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

  // Scan route files for @openapi JSDoc annotations
  apis: ["./src/modules/**/*.routes.ts", "./src/server.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
