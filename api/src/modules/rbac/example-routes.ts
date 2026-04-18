import { Router } from "express";
import { authenticate, authorize, authorizeAny } from "./authorize.middleware.js";

/**
 * Example Protected Routes with RBAC
 * 
 * Demonstrates different authorization patterns:
 * - Single permission
 * - Multiple permissions (ANY)
 * - Conditional logic based on permissions
 */

const router = Router();

// ─── User Management Routes ───────────────────────────────────────────────────

/**
 * List users - requires "users:view" permission
 */
router.get(
  "/users",
  authenticate,
  authorize("users:view"),
  async (req, res) => {
    // User has "users:view" permission
    // All queries automatically scoped by req.clinicId
    res.json({ message: "List users", clinicId: req.clinicId });
  }
);

/**
 * Create user - requires "users:create" permission
 */
router.post(
  "/users",
  authenticate,
  authorize("users:create"),
  async (req, res) => {
    // User has "users:create" permission
    res.json({ message: "Create user", clinicId: req.clinicId });
  }
);

/**
 * Delete user - requires "users:delete" permission
 */
router.delete(
  "/users/:id",
  authenticate,
  authorize("users:delete"),
  async (req, res) => {
    // User has "users:delete" permission
    res.json({ message: "Delete user", userId: req.params.id });
  }
);

/**
 * Assign role to user - requires "users:manage_roles" permission
 */
router.post(
  "/users/:id/roles",
  authenticate,
  authorize("users:manage_roles"),
  async (req, res) => {
    // User has "users:manage_roles" permission
    res.json({ message: "Assign role", userId: req.params.id });
  }
);

// ─── Appointment Routes ───────────────────────────────────────────────────────

/**
 * List appointments - requires EITHER "appointments:view_all" OR "appointments:view_own"
 * 
 * Doctors/Admins have "appointments:view_all"
 * Patients have "appointments:view_own"
 */
router.get(
  "/appointments",
  authenticate,
  authorizeAny(["appointments:view_all", "appointments:view_own"]),
  async (req, res) => {
    // User has at least one of the required permissions
    // Service layer will filter based on specific permission
    
    const canViewAll = req.user!.permissions.includes("appointments:view_all");
    
    if (canViewAll) {
      // Return all appointments in clinic
      res.json({ message: "All appointments", clinicId: req.clinicId });
    } else {
      // Return only user's own appointments
      res.json({ 
        message: "Own appointments", 
        userId: req.user!.userId,
        clinicId: req.clinicId 
      });
    }
  }
);

/**
 * Create appointment - requires "appointments:create" permission
 */
router.post(
  "/appointments",
  authenticate,
  authorize("appointments:create"),
  async (req, res) => {
    res.json({ message: "Create appointment" });
  }
);

/**
 * Delete appointment - requires "appointments:delete" permission
 */
router.delete(
  "/appointments/:id",
  authenticate,
  authorize("appointments:delete"),
  async (req, res) => {
    res.json({ message: "Delete appointment", appointmentId: req.params.id });
  }
);

// ─── Role Management Routes ───────────────────────────────────────────────────

/**
 * List roles - requires "roles:view" permission
 */
router.get(
  "/roles",
  authenticate,
  authorize("roles:view"),
  async (req, res) => {
    // Returns global roles + clinic-specific roles
    res.json({ message: "List roles", clinicId: req.clinicId });
  }
);

/**
 * Create role - requires "roles:create" permission
 */
router.post(
  "/roles",
  authenticate,
  authorize("roles:create"),
  async (req, res) => {
    // Creates clinic-specific role
    res.json({ message: "Create role", clinicId: req.clinicId });
  }
);

/**
 * Update role permissions - requires "roles:update" permission
 */
router.patch(
  "/roles/:id/permissions",
  authenticate,
  authorize("roles:update"),
  async (req, res) => {
    // Updates clinic-specific role only (cannot modify global roles)
    res.json({ message: "Update role permissions", roleId: req.params.id });
  }
);

// ─── Clinic Management Routes ─────────────────────────────────────────────────

/**
 * View clinic settings - requires "clinic:view" permission
 */
router.get(
  "/clinic",
  authenticate,
  authorize("clinic:view"),
  async (req, res) => {
    res.json({ message: "View clinic", clinicId: req.clinicId });
  }
);

/**
 * Update clinic settings - requires "clinic:update" permission
 */
router.patch(
  "/clinic",
  authenticate,
  authorize("clinic:update"),
  async (req, res) => {
    res.json({ message: "Update clinic", clinicId: req.clinicId });
  }
);

// ─── Reports Routes ───────────────────────────────────────────────────────────

/**
 * View reports - requires "reports:view" permission
 */
router.get(
  "/reports",
  authenticate,
  authorize("reports:view"),
  async (req, res) => {
    res.json({ message: "View reports", clinicId: req.clinicId });
  }
);

/**
 * Export reports - requires "reports:export" permission
 */
router.post(
  "/reports/export",
  authenticate,
  authorize("reports:export"),
  async (req, res) => {
    res.json({ message: "Export reports", clinicId: req.clinicId });
  }
);

// ─── System Administration Routes ─────────────────────────────────────────────

/**
 * View system logs - requires "system:view_logs" permission
 */
router.get(
  "/system/logs",
  authenticate,
  authorize("system:view_logs"),
  async (req, res) => {
    res.json({ message: "View system logs" });
  }
);

export default router;
