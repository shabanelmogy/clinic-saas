import { Router } from "express";
import { doctorScheduleController } from "./doctor-schedule.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { createDoctorScheduleSchemas, dayOfWeekParamSchema } from "./doctor-schedule.validation.js";
import { z } from "zod";

const doctorIdParamSchema = z.object({ doctorId: z.string().uuid() });

// ─── Public router (mounted under /clinics) ───────────────────────────────────
// ✅ Full param path defined here — not on app.use()
export const publicScheduleRouter = Router({ mergeParams: true });

/**
 * @openapi
 * /clinics/{clinicId}/doctors/{doctorId}/schedules:
 *   get:
 *     tags: [DoctorSchedules]
 *     summary: Get doctor's weekly schedule (public)
 *     parameters:
 *       - name: clinicId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: doctorId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of active schedule rules
 */
publicScheduleRouter.get("/:clinicId/doctors/:doctorId/schedules", doctorScheduleController.listPublic);

// ─── Staff router (mounted under /doctors) ────────────────────────────────────
// ✅ Full param path defined here — not on app.use()
const router = Router({ mergeParams: true });

/**
 * @openapi
 * /doctors/{doctorId}/schedules:
 *   get:
 *     tags: [DoctorSchedules]
 *     summary: Get all schedule rules for a doctor (staff)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: doctorId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of schedule rules
 *       404:
 *         description: Doctor not found
 */
router.get(
  "/:doctorId/schedules",
  authenticate,
  authorize("doctors:view"),
  validate({ params: doctorIdParamSchema }),
  doctorScheduleController.list
);

/**
 * @openapi
 * /doctors/{doctorId}/schedules:
 *   put:
 *     tags: [DoctorSchedules]
 *     summary: Create or update a schedule rule for a day
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: doctorId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dayOfWeek, startTime, endTime]
 *             properties:
 *               dayOfWeek: { type: string, enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday] }
 *               startTime: { type: string, pattern: "^\\d{2}:\\d{2}$", example: "09:00" }
 *               endTime: { type: string, pattern: "^\\d{2}:\\d{2}$", example: "17:00" }
 *               slotDurationMinutes: { type: integer, minimum: 5, maximum: 480, default: 30 }
 *               maxAppointments: { type: integer, minimum: 1, maximum: 50, default: 1 }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: Schedule rule created or updated
 */
router.put(
  "/:doctorId/schedules",
  authenticate,
  authorize("doctors:update"),
  validate({
    params: doctorIdParamSchema,
    body: (t) => createDoctorScheduleSchemas(t).upsert,
  }),
  doctorScheduleController.upsert
);

/**
 * @openapi
 * /doctors/{doctorId}/schedules/{day}:
 *   delete:
 *     tags: [DoctorSchedules]
 *     summary: Delete a schedule rule for a specific day
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: doctorId
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - name: day
 *         in: path
 *         required: true
 *         schema: { type: string, enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday] }
 *     responses:
 *       200:
 *         description: Schedule rule deleted
 *       404:
 *         description: Schedule not found
 */
router.delete(
  "/:doctorId/schedules/:day",
  authenticate,
  authorize("doctors:update"),
  validate({ params: dayOfWeekParamSchema }),
  doctorScheduleController.remove
);

export default router;
