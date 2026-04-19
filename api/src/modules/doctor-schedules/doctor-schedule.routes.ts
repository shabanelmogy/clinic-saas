import { Router } from "express";
import { doctorScheduleController } from "./doctor-schedule.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { createDoctorScheduleSchemas, dayOfWeekParamSchema } from "./doctor-schedule.validation.js";
import { z } from "zod";

const doctorIdParamSchema = z.object({ doctorId: z.string().uuid() });

// ─── Public router (mounted under /clinics/:clinicId/doctors/:doctorId/schedules)
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
publicScheduleRouter.get("/", doctorScheduleController.listPublic);

// ─── Staff router (mounted under /doctors/:doctorId/schedules)
const router = Router({ mergeParams: true });

/**
 * @openapi
 * /doctors/{doctorId}/schedules:
 *   get:
 *     tags: [DoctorSchedules]
 *     summary: Get all schedule rules for a doctor (staff)
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
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
 */
router.put(
  "/",
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
 */
router.delete(
  "/:day",
  authenticate,
  authorize("doctors:update"),
  validate({ params: dayOfWeekParamSchema }),
  doctorScheduleController.remove
);

export default router;
