import { Router } from "express";
import { staffUserController } from "./staff-user.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createStaffUserSchemas } from "./staff-user.validation.js";

const router = Router();

/**
 * @openapi
 * /staff-users:
 *   get:
 *     tags: [StaffUsers]
 *     summary: List all staff users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: isActive
 *         in: query
 *         schema: { type: string, enum: [true, false] }
 *       - name: search
 *         in: query
 *         schema: { type: string, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of staff users
 */
router.get(
  "/",
  authenticate,
  authorize("users:view"),
  validate({ query: (t) => createStaffUserSchemas(t).listQuery }),
  staffUserController.list
);

/**
 * @openapi
 * /staff-users/{id}:
 *   get:
 *     tags: [StaffUsers]
 *     summary: Get a staff user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Staff user found
 *       404:
 *         description: Staff user not found
 */
router.get(
  "/:id",
  authenticate,
  validate({ params: idParamSchema }),
  staffUserController.getById
);

/**
 * @openapi
 * /staff-users:
 *   post:
 *     tags: [StaffUsers]
 *     summary: Create a new staff user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Staff user created
 *       409:
 *         description: Email already in use
 */
router.post(
  "/",
  authenticate,
  authorize("users:create"),
  validate({ body: (t) => createStaffUserSchemas(t).create }),
  staffUserController.create
);

/**
 * @openapi
 * /staff-users/{id}:
 *   patch:
 *     tags: [StaffUsers]
 *     summary: Update a staff user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Staff user updated
 *       404:
 *         description: Staff user not found
 */
router.patch(
  "/:id",
  authenticate,
  authorize("users:update"),
  validate({ params: idParamSchema, body: (t) => createStaffUserSchemas(t).update }),
  staffUserController.update
);

/**
 * @openapi
 * /staff-users/{id}:
 *   delete:
 *     tags: [StaffUsers]
 *     summary: Soft-delete a staff user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Staff user deleted
 *       404:
 *         description: Staff user not found
 */
router.delete(
  "/:id",
  authenticate,
  authorize("users:delete"),
  validate({ params: idParamSchema }),
  staffUserController.remove
);

export default router;
