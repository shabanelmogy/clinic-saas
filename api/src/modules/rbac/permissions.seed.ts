/**
 * FIXED Permissions - Seeded in Database
 * 
 * These permissions are immutable and define all possible actions in the system.
 * Roles are assigned combinations of these permissions.
 */

export const PERMISSIONS = [
  // ─── User Management ────────────────────────────────────────────────────────
  {
    key: "users:view",
    name: "View Users",
    description: "View user list and details",
    category: "users",
  },
  {
    key: "users:create",
    name: "Create Users",
    description: "Create new users in the system",
    category: "users",
  },
  {
    key: "users:update",
    name: "Update Users",
    description: "Update user information",
    category: "users",
  },
  {
    key: "users:delete",
    name: "Delete Users",
    description: "Delete users from the system",
    category: "users",
  },
  {
    key: "users:manage_roles",
    name: "Manage User Roles",
    description: "Assign and remove roles from users",
    category: "users",
  },

  // ─── Role Management ────────────────────────────────────────────────────────
  {
    key: "roles:view",
    name: "View Roles",
    description: "View role list and details",
    category: "roles",
  },
  {
    key: "roles:create",
    name: "Create Roles",
    description: "Create new roles",
    category: "roles",
  },
  {
    key: "roles:update",
    name: "Update Roles",
    description: "Update role information and permissions",
    category: "roles",
  },
  {
    key: "roles:delete",
    name: "Delete Roles",
    description: "Delete roles from the system",
    category: "roles",
  },

  // ─── Appointment Management ─────────────────────────────────────────────────
  {
    key: "appointments:view_all",
    name: "View All Appointments",
    description: "View all appointments in the clinic",
    category: "appointments",
  },
  {
    key: "appointments:view_own",
    name: "View Own Appointments",
    description: "View only own appointments",
    category: "appointments",
  },
  {
    key: "appointments:create",
    name: "Create Appointments",
    description: "Create new appointments",
    category: "appointments",
  },
  {
    key: "appointments:update",
    name: "Update Appointments",
    description: "Update appointment details",
    category: "appointments",
  },
  {
    key: "appointments:delete",
    name: "Delete Appointments",
    description: "Delete appointments",
    category: "appointments",
  },

  // ─── Clinic Management ──────────────────────────────────────────────────────
  {
    key: "clinic:view",
    name: "View Clinic",
    description: "View clinic information",
    category: "clinic",
  },
  {
    key: "clinic:update",
    name: "Update Clinic",
    description: "Update clinic settings and information",
    category: "clinic",
  },
  {
    key: "clinic:manage_billing",
    name: "Manage Billing",
    description: "Manage clinic billing and subscriptions",
    category: "clinic",
  },

  // ─── Reports & Analytics ────────────────────────────────────────────────────
  {
    key: "reports:view",
    name: "View Reports",
    description: "View clinic reports and analytics",
    category: "reports",
  },
  {
    key: "reports:export",
    name: "Export Reports",
    description: "Export reports and data",
    category: "reports",
  },

  // ─── System Administration ──────────────────────────────────────────────────
  {
    key: "system:view_logs",
    name: "View System Logs",
    description: "View system audit logs",
    category: "system",
  },
  {
    key: "system:manage_settings",
    name: "Manage System Settings",
    description: "Manage system-wide settings",
    category: "system",
  },
] as const;

/**
 * Default Global Roles with Permission Mappings
 * These are seeded as global roles (clinic_id = null)
 */
export const DEFAULT_ROLES = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Full system access - can manage everything",
    permissions: [
      "users:view",
      "users:create",
      "users:update",
      "users:delete",
      "users:manage_roles",
      "roles:view",
      "roles:create",
      "roles:update",
      "roles:delete",
      "appointments:view_all",
      "appointments:create",
      "appointments:update",
      "appointments:delete",
      "clinic:view",
      "clinic:update",
      "clinic:manage_billing",
      "reports:view",
      "reports:export",
      "system:view_logs",
      "system:manage_settings",
    ],
  },
  CLINIC_ADMIN: {
    name: "Clinic Admin",
    description: "Clinic administrator - can manage clinic users and settings",
    permissions: [
      "users:view",
      "users:create",
      "users:update",
      "users:manage_roles",
      "roles:view",
      "appointments:view_all",
      "appointments:create",
      "appointments:update",
      "appointments:delete",
      "clinic:view",
      "clinic:update",
      "reports:view",
      "reports:export",
    ],
  },
  DOCTOR: {
    name: "Doctor",
    description: "Medical professional - can manage appointments and view patients",
    permissions: [
      "users:view",
      "appointments:view_all",
      "appointments:create",
      "appointments:update",
      "clinic:view",
      "reports:view",
    ],
  },
  RECEPTIONIST: {
    name: "Receptionist",
    description: "Front desk staff - can manage appointments",
    permissions: [
      "users:view",
      "appointments:view_all",
      "appointments:create",
      "appointments:update",
      "clinic:view",
    ],
  },
  PATIENT: {
    name: "Patient",
    description: "Patient - can view and manage own appointments",
    permissions: [
      "appointments:view_own",
      "appointments:create",
      "clinic:view",
    ],
  },
} as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export type DefaultRoleKey = keyof typeof DEFAULT_ROLES;
