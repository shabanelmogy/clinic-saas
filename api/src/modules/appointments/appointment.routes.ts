import { Router } from "express";
import { appointmentController } from "./appointment.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize, authorizeAny } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createAppointmentSchemas } from "./appointment.validation.js";

const router = Router();

/**
 * @openapi
 * /appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: List all appointments
 *     description: Returns a paginated list of appointments. Supports filtering by userId, status, and date range.
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: userId
 *         in: query
 *         description: Filter by user UUID
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: status
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/AppointmentStatus'
 *       - name: from
 *         in: query
 *         description: Start of date range (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2026-01-01T00:00:00Z"
 *       - name: to
 *         in: query
 *         description: End of date range (ISO 8601)
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2026-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Paginated list of appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Appointments retrieved }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.get(
  "/",
  authenticate,
  authorizeAny(["appointments:view_all", "appointments:view_own"]),
  validate({ query: (t) => createAppointmentSchemas(t).listQuery }),
  appointmentController.list
);

/**
 * @openapi
 * /appointments/{id}:
 *   get:
 *     tags: [Appointments]
 *     summary: Get an appointment by ID
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Appointment found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Appointment retrieved }
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       404:
 *         description: Appointment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       422:
 *         description: Invalid UUID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.get(
  "/:id",
  authenticate,
  validate({ params: idParamSchema }),
  appointmentController.getById
);

/**
 * @openapi
 * /appointments:
 *   post:
 *     tags: [Appointments]
 *     summary: Create a new appointment
 *     description: The `scheduledAt` must be a future datetime. The referenced `userId` must exist and be active.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAppointmentBody'
 *           example:
 *             userId: "550e8400-e29b-41d4-a716-446655440000"
 *             title: Initial Consultation
 *             description: First meeting with the client
 *             scheduledAt: "2026-06-15T10:00:00Z"
 *             durationMinutes: 60
 *             notes: Bring portfolio
 *     responses:
 *       201:
 *         description: Appointment created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Appointment created successfully }
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: User is inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.post(
  "/",
  authenticate,
  authorize("appointments:create"),
  validate({ body: (t) => createAppointmentSchemas(t).create }),
  appointmentController.create
);

/**
 * @openapi
 * /appointments/{id}:
 *   patch:
 *     tags: [Appointments]
 *     summary: Update an appointment
 *     description: Cannot update appointments with status `cancelled` or `completed`.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAppointmentBody'
 *           example:
 *             status: confirmed
 *             notes: Client confirmed via phone
 *     responses:
 *       200:
 *         description: Appointment updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Appointment updated successfully }
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Cannot update a cancelled or completed appointment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       404:
 *         description: Appointment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.patch(
  "/:id",
  authenticate,
  authorize("appointments:update"),
  validate({ 
    params: idParamSchema, 
    body: (t) => createAppointmentSchemas(t).update 
  }),
  appointmentController.update
);

/**
 * @openapi
 * /appointments/{id}:
 *   delete:
 *     tags: [Appointments]
 *     summary: Delete an appointment
 *     description: Cannot delete a `confirmed` appointment — cancel it first.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Appointment deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Appointment deleted successfully }
 *                 data: { nullable: true, example: null }
 *       400:
 *         description: Cannot delete a confirmed appointment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       404:
 *         description: Appointment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       422:
 *         description: Invalid UUID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.delete(
  "/:id",
  authenticate,
  authorize("appointments:delete"),
  validate({ params: idParamSchema }),
  appointmentController.remove
);

export default router;
