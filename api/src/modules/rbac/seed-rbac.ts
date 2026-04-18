import { db } from "../../db/index.js";
import { permissions, roles, rolePermissions } from "./rbac.schema.js";
import { PERMISSIONS, DEFAULT_ROLES } from "./permissions.seed.js";
import { eq } from "drizzle-orm";

/**
 * Seed RBAC System
 * 
 * 1. Seeds all permissions (FIXED)
 * 2. Seeds default global roles
 * 3. Assigns permissions to roles
 * 
 * Run with: npm run seed:rbac
 */

async function seedPermissions() {
  console.log("🌱 Seeding permissions...");

  for (const perm of PERMISSIONS) {
    // Check if permission already exists
    const [existing] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.key, perm.key))
      .limit(1);

    if (!existing) {
      await db.insert(permissions).values({
        key: perm.key,
        name: perm.name,
        description: perm.description,
        category: perm.category,
      });
      console.log(`  ✅ Created permission: ${perm.key}`);
    } else {
      console.log(`  ⏭️  Permission already exists: ${perm.key}`);
    }
  }

  console.log(`✅ Seeded ${PERMISSIONS.length} permissions\n`);
}

async function seedDefaultRoles() {
  console.log("🌱 Seeding default global roles...");

  for (const [roleKey, roleData] of Object.entries(DEFAULT_ROLES)) {
    // Check if role already exists (global roles have clinic_id = null)
    const [existingRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleData.name))
      .limit(1);

    let role;
    if (!existingRole) {
      [role] = await db
        .insert(roles)
        .values({
          name: roleData.name,
          description: roleData.description,
          clinicId: null, // Global role
        })
        .returning();
      console.log(`  ✅ Created role: ${roleData.name}`);
    } else {
      role = existingRole;
      console.log(`  ⏭️  Role already exists: ${roleData.name}`);
    }

    // Assign permissions to role
    for (const permKey of roleData.permissions) {
      // Get permission ID
      const [permission] = await db
        .select()
        .from(permissions)
        .where(eq(permissions.key, permKey))
        .limit(1);

      if (!permission) {
        console.warn(`  ⚠️  Permission not found: ${permKey}`);
        continue;
      }

      // Check if role-permission mapping already exists
      const [existing] = await db
        .select()
        .from(rolePermissions)
        .where(
          eq(rolePermissions.roleId, role.id) &&
          eq(rolePermissions.permissionId, permission.id)
        )
        .limit(1);

      if (!existing) {
        await db.insert(rolePermissions).values({
          roleId: role.id,
          permissionId: permission.id,
        });
      }
    }

    console.log(`  ✅ Assigned ${roleData.permissions.length} permissions to ${roleData.name}`);
  }

  console.log(`✅ Seeded ${Object.keys(DEFAULT_ROLES).length} default roles\n`);
}

export async function seedRBAC() {
  console.log("🚀 Starting RBAC seed...\n");
  await seedPermissions();
  await seedDefaultRoles();
  console.log("✅ RBAC seed completed successfully!");
}

async function main() {
  try {
    await seedRBAC();
    process.exit(0);
  } catch (error) {
    console.error("❌ RBAC seed failed:", error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
