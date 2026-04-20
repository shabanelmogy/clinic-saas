import { Router } from "express";
import { appointmentController } from "./appointment.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize, authorizeAny } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createAppointmentSchemas, cancelAppointmentSchema } from "./appointment.validation.js";

const router = Router();

// ─── IMPORTANT: Static routes MUST come before /:id routes ───────────────────
// Express matches routes in registration order. If GET /:id is registered first,
// it will capture "enriched" as the :id param and fail UUID validation (422).
// Rule: register all /static-path routes before any /:param routes.

// ─── Static collection routes ─────────────────────────────────────────────────

/**
 * @openapi
 * /appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: List all appointments
 *     description: Returns a paginated list of appointments. Supports filtering by status and date range.
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/AppointmentStatus'
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Paginated list of appointments
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
 * /appointments/enriched:
 *   get:
 *     tags: [Appointments]
 *     summary: List appointments with patient and doctor names (joined)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         schema:
 *           $ref: '#/components/schemas/AppointmentStatus'
 *     responses:
 *       200:
 *         description: Paginated list of enriched appointments
 */
router.get(
  "/enriched",
  authenticate,
  authorizeAny(["appointments:view_all", "appointments:view_own"]),
  validate({ query: (t) => createAppointmentSchemas(t).listQuery }),
  appointmentController.listEnriched
);

/**
 * @openapi
 * /appointments:
 *   post:
 *     tags: [Appointments]
 *     summary: Create a new appointment
 *     description: |
 *       If `slotId` is provided, books the slot atomically (SELECT FOR UPDATE).
 *       Without `slotId`, creates a walk-in appointment with the provided `scheduledAt`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, scheduledAt]
 *             properties:
 *               patientId: { type: string, format: uuid }
 *               clinicId: { type: string, format: uuid }
 *               slotId: { type: string, format: uuid }
 *               title: { type: string, minLength: 2, maxLength: 200 }
 *               description: { type: string }
 *               scheduledAt: { type: string, format: date-time }
 *               durationMinutes: { type: integer, minimum: 5, maximum: 480, default: 60 }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Appointment created
 *       409:
 *         description: Slot no longer available
 */
router.post(
  "/",
  authenticate,
  authorize("appointments:create"),
  validate({ body: (t) => createAppointmentSchemas(t).create }),
  appointmentController.create
);

// ─── Parameterized routes — MUST come after all static routes ─────────────────

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
 *       404:
 *         description: Appointment not found
 */
router.get(
  "/:id",
  authenticate,
  validate({ params: idParamSchema }),
  appointmentController.getById
);

/**
 * @openapi
 * /appointments/{id}/enriched:
 *   get:
 *     tags: [Appointments]
 *     summary: Get appointment with patient and doctor names
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Enriched appointment detail
 */
router.get(
  "/:id/enriched",
  authenticate,
  validate({ params: idParamSchema }),
  appointmentController.getByIdEnriched
);

/**
 * @openapi
 * /appointments/{id}/history:
 *   get:
 *     tags: [Appointments]
 *     summary: Get appointment status history (audit trail)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: List of status change events
 */
router.get(
  "/:id/history",
  authenticate,
  authorizeAny(["appointments:view_all", "appointments:view_own"]),
  validate({ params: idParamSchema }),
  appointmentController.getHistory
);

/**
 * @openapi
 * /appointments/{id}:
 *   patch:
 *     tags: [Appointments]
 *     summary: Update an appointment
 *     description: Cannot update appointments with status `cancelled` or `completed`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               scheduledAt: { type: string, format: date-time }
 *               durationMinutes: { type: integer }
 *               status: { type: string, enum: [pending, confirmed, cancelled, completed, no_show] }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Appointment updated
 *       400:
 *         description: Cannot update a terminal appointment
 */
router.patch(
  "/:id",
  authenticate,
  authorize("appointments:update"),
  validate({ params: idParamSchema, body: (t) => createAppointmentSchemas(t).update }),
  appointmentController.update
);

/**
 * @openapi
 * /appointments/{id}:
 *   delete:
 *     tags: [Appointments]
 *     summary: Soft-delete an appointment
 *     description: Cannot delete a `confirmed` appointment — cancel it first.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Appointment deleted
 *       400:
 *         description: Cannot delete a confirmed appointment
 */
router.delete(
  "/:id",
  authenticate,
  authorize("appointments:delete"),
  validate({ params: idParamSchema }),
  appointmentController.remove
);

/**
 * @openapi
 * /appointments/{id}/cancel:
 *   post:
 *     tags: [Appointments]
 *     summary: Cancel an appointment
 *     description: Transactionally cancels and releases the linked slot. Uses optimistic locking.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Appointment cancelled and slot released
 *       409:
 *         description: Concurrent update detected — retry
 */
router.post(
  "/:id/cancel",
  authenticate,
  authorizeAny(["appointments:update", "appointments:view_own"]),
  validate({ params: idParamSchema, body: (t) => cancelAppointmentSchema(t) }),
  appointmentController.cancel
);

export default router;
