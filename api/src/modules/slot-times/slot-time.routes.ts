import { Router } from "express";
import { slotTimeController } from "./slot-time.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createSlotTimeSchemas } from "./slot-time.validation.js";

const router = Router();

/**
 * @openapi
 * /slot-times:
 *   get:
 *     tags: [SlotTimes]
 *     summary: List available slots
 *     description: |
 *       Public: returns only available slots (no auth required).
 *       Staff: returns all statuses when authenticated.
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: clinicId
 *         in: query
 *         required: true (for public access)
 *         schema: { type: string, format: uuid }
 *       - name: doctorId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [available, booked, blocked] }
 *       - name: from
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: to
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Paginated list of slots
 */
router.get(
  "/",
  validate({ query: (t) => createSlotTimeSchemas(t).listQuery }),
  slotTimeController.list
);

/**
 * @openapi
 * /slot-times/generate:
 *   post:
 *     tags: [SlotTimes]
 *     summary: Generate slots from schedule rules
 *     description: Generates bookable slots for a doctor over a date range. Idempotent — existing slots are skipped.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doctorId, from, to]
 *             properties:
 *               doctorId: { type: string, format: uuid }
 *               from: { type: string, format: date-time, example: "2026-05-01T00:00:00Z" }
 *               to: { type: string, format: date-time, example: "2026-05-31T23:59:59Z" }
 *     responses:
 *       201:
 *         description: Slots generated
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  "/generate",
  authenticate,
  authorize("slots:generate"),
  validate({ body: (t) => createSlotTimeSchemas(t).generate }),
  slotTimeController.generate
);

/**
 * @openapi
 * /slot-times/{id}/book:
 *   post:
 *     tags: [SlotTimes]
 *     summary: Book a slot
 *     description: Atomically marks a slot as booked and links it to an appointment.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Slot booked
 *       409:
 *         description: Slot no longer available
 */
router.post(
  "/:id/book",
  authenticate,
  authorize("slots:book"),
  validate({ params: idParamSchema, body: (t) => createSlotTimeSchemas(t).book }),
  slotTimeController.book
);

/**
 * @openapi
 * /slot-times/{id}/release:
 *   post:
 *     tags: [SlotTimes]
 *     summary: Release a booked slot
 *     description: Resets a booked slot back to available. Called on appointment cancellation.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Slot released
 *       400:
 *         description: Slot is not booked
 */
router.post(
  "/:id/release",
  authenticate,
  authorize("slots:book"),
  validate({ params: idParamSchema }),
  slotTimeController.release
);

/**
 * @openapi
 * /slot-times/{id}/status:
 *   patch:
 *     tags: [SlotTimes]
 *     summary: Block or unblock a slot
 *     description: Staff can manually block/unblock available slots (holidays, breaks).
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [available, blocked] }
 *     responses:
 *       200:
 *         description: Slot status updated
 *       400:
 *         description: Cannot modify a booked slot
 */
router.patch(
  "/:id/status",
  authenticate,
  authorize("slots:manage"),
  validate({ params: idParamSchema, body: (t) => createSlotTimeSchemas(t).updateStatus }),
  slotTimeController.updateStatus
);

export default router;
