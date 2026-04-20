import { Router } from "express";
import { roleController } from "./role.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "./authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createRoleSchemas } from "./role.validation.js";

const router = Router();

/**
 * @openapi
 * /roles/permissions:
 *   get:
 *     tags: [Roles]
 *     summary: List all available permissions
 *     description: Returns all system permissions grouped by category. Used to build role assignment UIs.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions list
 */
router.get(
  "/permissions",
  authenticate,
  authorize("roles:view"),
  roleController.listPermissions
);

/**
 * @openapi
 * /roles/assignments:
 *   get:
 *     tags: [Roles]
 *     summary: List all role assignments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: staffUserId
 *         in: query
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paginated list of assignments
 */
router.get(
  "/assignments",
  authenticate,
  authorize("users:manage_roles"),
  roleController.listAssignments
);

/**
 * @openapi
 * /roles/assign:
 *   post:
 *     tags: [Roles]
 *     summary: Assign a role to a staff user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [staffUserId, roleId]
 *             properties:
 *               staffUserId: { type: string, format: uuid }
 *               roleId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Role assigned
 *       404:
 *         description: Staff user or role not found
 */
router.post(
  "/assign",
  authenticate,
  authorize("users:manage_roles"),
  validate({ body: (t) => createRoleSchemas(t).assignRole }),
  roleController.assignRole
);

/**
 * @openapi
 * /roles/unassign:
 *   post:
 *     tags: [Roles]
 *     summary: Remove a role from a staff user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [staffUserId, roleId]
 *             properties:
 *               staffUserId: { type: string, format: uuid }
 *               roleId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Role removed
 *       404:
 *         description: Assignment not found
 */
router.post(
  "/unassign",
  authenticate,
  authorize("users:manage_roles"),
  validate({ body: (t) => createRoleSchemas(t).removeRole }),
  roleController.removeRole
);

/**
 * @openapi
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: List roles
 *     description: Returns global roles and clinic-specific roles accessible to the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: search
 *         in: query
 *         schema: { type: string, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of roles
 */
router.get(
  "/",
  authenticate,
  authorize("roles:view"),
  validate({ query: (t) => createRoleSchemas(t).listQuery }),
  roleController.list
);

/**
 * @openapi
 * /roles/{id}:
 *   get:
 *     tags: [Roles]
 *     summary: Get a role by ID
 *     description: Returns the role with its assigned permissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Role found
 *       404:
 *         description: Role not found
 */
router.get(
  "/:id",
  authenticate,
  authorize("roles:view"),
  validate({ params: idParamSchema }),
  roleController.getById
);

/**
 * @openapi
 * /roles:
 *   post:
 *     tags: [Roles]
 *     summary: Create a clinic-scoped role
 *     description: Creates a new role for the authenticated user's clinic. Global roles are system-managed.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 100, example: "Senior Doctor" }
 *               description: { type: string, maxLength: 500 }
 *               permissionIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Role created
 *       409:
 *         description: Role name already exists in this clinic
 */
router.post(
  "/",
  authenticate,
  authorize("roles:create"),
  validate({ body: (t) => createRoleSchemas(t).create }),
  roleController.create
);

/**
 * @openapi
 * /roles/{id}:
 *   patch:
 *     tags: [Roles]
 *     summary: Update a clinic-scoped role
 *     description: Updates name, description, and/or permissions. Global roles cannot be modified.
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
 *               name: { type: string, minLength: 2, maxLength: 100 }
 *               description: { type: string, maxLength: 500 }
 *               permissionIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Role updated
 *       403:
 *         description: Cannot modify global roles
 *       404:
 *         description: Role not found
 */
router.patch(
  "/:id",
  authenticate,
  authorize("roles:update"),
  validate({ params: idParamSchema, body: (t) => createRoleSchemas(t).update }),
  roleController.update
);

/**
 * @openapi
 * /roles/{id}:
 *   delete:
 *     tags: [Roles]
 *     summary: Delete a clinic-scoped role
 *     description: Deletes a role. Blocked if the role is still assigned to any staff user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Role deleted
 *       400:
 *         description: Role is still in use
 *       403:
 *         description: Cannot delete global roles
 *       404:
 *         description: Role not found
 */
router.delete(
  "/:id",
  authenticate,
  authorize("roles:delete"),
  validate({ params: idParamSchema }),
  roleController.remove
);

export default router;
