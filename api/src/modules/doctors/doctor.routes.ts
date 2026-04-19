import { Router } from "express";
import { z } from "zod";
import { doctorController } from "./doctor.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createDoctorSchemas } from "./doctor.validation.js";

// ─── Public router (mounted under /clinics) ───────────────────────────────────
// ✅ Param :clinicId defined HERE — not on app.use() — so Express populates it correctly
export const publicDoctorRouter = Router({ mergeParams: true });

/**
 * @openapi
 * /clinics/{clinicId}/doctors:
 *   get:
 *     tags: [Doctors]
 *     summary: List doctors for a clinic (public marketplace)
 */
publicDoctorRouter.get(
  "/:clinicId/doctors",
  validate({ query: (t) => createDoctorSchemas(t).listQuery }),
  doctorController.listPublic
);

/**
 * @openapi
 * /clinics/{clinicId}/doctors/{id}:
 *   get:
 *     tags: [Doctors]
 *     summary: Get doctor by ID (public)
 */
publicDoctorRouter.get(
  "/:clinicId/doctors/:id",
  validate({ params: z.object({ clinicId: z.string().uuid(), id: z.string().uuid() }) }),
  doctorController.getByIdPublic
);

// ─── Staff router (mounted under /doctors) ────────────────────────────────────
const router = Router();

router.get(
  "/",
  authenticate,
  authorize("doctors:view"),
  validate({ query: (t) => createDoctorSchemas(t).listQuery }),
  doctorController.list
);

router.get(
  "/:id",
  authenticate,
  authorize("doctors:view"),
  validate({ params: idParamSchema }),
  doctorController.getById
);

router.post(
  "/",
  authenticate,
  authorize("doctors:create"),
  validate({ body: (t) => createDoctorSchemas(t).create }),
  doctorController.create
);

router.patch(
  "/:id",
  authenticate,
  authorize("doctors:update"),
  validate({ params: idParamSchema, body: (t) => createDoctorSchemas(t).update }),
  doctorController.update
);

router.delete(
  "/:id",
  authenticate,
  authorize("doctors:delete"),
  validate({ params: idParamSchema }),
  doctorController.remove
);

export default router;
