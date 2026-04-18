# Quick Reference Guide - Production Backend

## 🚀 Quick Start

### 1. Adding a New Route

```typescript
import { authenticate, requirePermission, Permission } from "../../middlewares/auth.middleware.js";

// Public route (no auth)
router.post("/login", validate({ body: loginSchema }), controller.login);

// Authenticated route
router.get(
  "/",
  authenticate,
  requirePermission(Permission.VIEW_USERS),
  validate({ query: listSchema }),
  controller.list
);

// Admin-only route
router.delete(
  "/:id",
  authenticate,
  requirePermission(Permission.DELETE_USER),
  validate({ params: idParamSchema }),
  controller.remove
);
```

### 2. Controller Pattern

```typescript
async list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await userService.listUsers(
      req.query as ListUsersQuery,
      req.user!.sub,           // requesting user ID
      req.user!.role as RoleType, // requesting user role
      req.tenantId!            // tenant ID from JWT
    );
    sendSuccess(res, "Users retrieved", result);
  } catch (err) {
    next(err);
  }
}
```

### 3. Service Pattern

```typescript
import { hasPermission, Permission, type RoleType } from "../config/rbac.js";
import { logger } from "../utils/logger.js";

const requirePermission = (userRole: RoleType, permission: string): void => {
  if (!hasPermission(userRole, permission as any)) {
    throw new ForbiddenError(`Permission '${permission}' is required`);
  }
};

export const myService = {
  async listItems(
    query: ListQuery,
    requestingUserId: string,
    requestingUserRole: RoleType,
    tenantId: string
  ) {
    // 1. Check permission
    requirePermission(requestingUserRole, Permission.VIEW_ITEMS);

    // 2. Query with tenant scope
    const { data, total } = await myRepository.findAll(query, tenantId);

    // 3. Log action
    logger.info({
      msg: "Items listed",
      requestingUserId,
      tenantId,
      count: data.length,
    });

    // 4. Return sanitized data
    return { data, total };
  },

  async createItem(
    input: CreateInput,
    requestingUserId: string,
    requestingUserRole: RoleType,
    tenantId: string
  ) {
    // 1. Check permission
    requirePermission(requestingUserRole, Permission.CREATE_ITEM);

    // 2. Validate business rules
    const existing = await myRepository.findByName(input.name, tenantId);
    if (existing) {
      throw new ConflictError("Item already exists");
    }

    // 3. Create with tenant scope
    const item = await myRepository.create({
      ...input,
      tenantId,
    });

    // 4. Log action
    logger.info({
      msg: "Item created",
      itemId: item.id,
      createdBy: requestingUserId,
      tenantId,
    });

    return item;
  },

  async deleteItem(
    id: string,
    requestingUserId: string,
    requestingUserRole: RoleType,
    tenantId: string
  ): Promise<void> {
    // 1. Check permission
    requirePermission(requestingUserRole, Permission.DELETE_ITEM);

    // 2. Verify exists
    const existing = await myRepository.findById(id, tenantId);
    if (!existing) throw new NotFoundError("Item");

    // 3. Check dependencies
    const childCount = await childRepository.countByParentId(id, tenantId);
    if (childCount > 0) {
      throw new BadRequestError(
        `Cannot delete: item has ${childCount} child record(s)`
      );
    }

    // 4. Delete in transaction
    await db.transaction(async (tx) => {
      await relatedRepository.deleteAllForItem(id);
      const deleted = await myRepository.delete(id, tenantId);
      if (!deleted) throw new NotFoundError("Item");
    });

    // 5. Log action
    logger.warn({
      msg: "Item deleted",
      itemId: id,
      deletedBy: requestingUserId,
      tenantId,
    });
  },
};
```

### 4. Repository Pattern

```typescript
import { eq, and, count, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";

export const myRepository = {
  /**
   * Find all items.
   * ALWAYS scoped by tenantId.
   */
  async findAll(
    query: ListQuery,
    tenantId: string
  ): Promise<{ data: Item[]; total: number }> {
    const { page, limit, status } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(items.tenantId, tenantId)];
    if (status) conditions.push(eq(items.status, status));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(items).where(where).limit(limit).offset(offset),
      db.select({ value: count() }).from(items).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find by ID.
   * ALWAYS scoped by tenantId.
   */
  async findById(id: string, tenantId: string): Promise<Item | undefined> {
    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.tenantId, tenantId)));
    return item;
  },

  /**
   * Create item.
   */
  async create(data: NewItem): Promise<Item> {
    const [item] = await db.insert(items).values(data).returning();
    return item;
  },

  /**
   * Update item.
   * ALWAYS scoped by tenantId.
   */
  async update(
    id: string,
    tenantId: string,
    data: Partial<NewItem>
  ): Promise<Item | undefined> {
    const [item] = await db
      .update(items)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(items.id, id), eq(items.tenantId, tenantId)))
      .returning();
    return item;
  },

  /**
   * Delete item.
   * ALWAYS scoped by tenantId.
   */
  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(items)
      .where(and(eq(items.id, id), eq(items.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  },
};
```

---

## 📋 Common Patterns

### Permission Check in Service

```typescript
import { hasPermission, Permission, type RoleType } from "../config/rbac.js";

const requirePermission = (userRole: RoleType, permission: string): void => {
  if (!hasPermission(userRole, permission as any)) {
    throw new ForbiddenError(`Permission '${permission}' is required`);
  }
};

// Usage
requirePermission(requestingUserRole, Permission.VIEW_USERS);
```

### Own Resource Check

```typescript
const isOwnResource = resourceUserId === requestingUserId;

if (isOwnResource) {
  requirePermission(requestingUserRole, Permission.UPDATE_OWN_PROFILE);
} else {
  requirePermission(requestingUserRole, Permission.UPDATE_USER);
}
```

### Transaction Pattern

```typescript
import { db } from "../../db/index.js";

await db.transaction(async (tx) => {
  // All operations here are atomic
  await repository1.deleteRelated(id);
  await repository2.deleteMain(id, tenantId);
  // If any fails, entire transaction rolls back
});
```

### Logging Pattern

```typescript
import { logger } from "../utils/logger.js";

// Info - normal operations
logger.info({
  msg: "Resource created",
  resourceId: resource.id,
  createdBy: requestingUserId,
  tenantId,
});

// Warn - destructive operations or auth failures
logger.warn({
  msg: "Resource deleted",
  resourceId: id,
  deletedBy: requestingUserId,
  tenantId,
});

// Error - exceptions
logger.error({
  msg: "Operation failed",
  error: err.message,
  stack: err.stack,
  userId: requestingUserId,
});
```

### Email Normalization

```typescript
// Always normalize before checking/storing
const normalizedEmail = input.email.toLowerCase();

const existing = await userRepository.findByEmail(normalizedEmail, tenantId);
if (existing) {
  throw new ConflictError("Email already exists");
}
```

### Safe Update Pattern

```typescript
// Build update object safely
const updateData: Partial<typeof existing> = {};

if (input.name !== undefined) updateData.name = input.name;
if (input.email !== undefined) updateData.email = input.email.toLowerCase();
if (input.isActive !== undefined) updateData.isActive = input.isActive;

const updated = await repository.update(id, tenantId, updateData);
if (!updated) throw new NotFoundError("Resource");
```

---

## 🔐 Available Permissions

```typescript
// User management
Permission.VIEW_USERS
Permission.CREATE_USER
Permission.UPDATE_USER
Permission.DELETE_USER
Permission.UPDATE_OWN_PROFILE

// Appointment management
Permission.VIEW_APPOINTMENTS
Permission.VIEW_OWN_APPOINTMENTS
Permission.CREATE_APPOINTMENT
Permission.UPDATE_APPOINTMENT
Permission.DELETE_APPOINTMENT
Permission.MANAGE_ALL_APPOINTMENTS

// System
Permission.VIEW_SYSTEM_LOGS
Permission.MANAGE_ROLES
```

---

## 🎭 Role Capabilities

### Admin
- Full system access
- All permissions

### Doctor
- View users (patients)
- Manage all appointments
- Update own profile

### Patient
- View own appointments
- Create appointments
- Update own profile

---

## ⚠️ Common Errors

```typescript
// Not found
throw new NotFoundError("User");

// Duplicate/conflict
throw new ConflictError("Email already exists");

// Business rule violation
throw new BadRequestError("Cannot delete user with active appointments");

// Insufficient permission
throw new ForbiddenError("Permission required");

// Not authenticated
throw new UnauthorizedError("Invalid token");
```

---

## 🧪 Testing Checklist

### For Each Endpoint

- [ ] ✅ Works with valid data
- [ ] ❌ Rejects without authentication
- [ ] ❌ Rejects without permission
- [ ] ❌ Rejects cross-tenant access
- [ ] ❌ Validates input properly
- [ ] ✅ Logs action correctly
- [ ] ✅ Returns sanitized data (no passwords)

### For Multi-Tenant

- [ ] User A (tenant 1) cannot see User B's data (tenant 2)
- [ ] Email uniqueness is per-tenant
- [ ] All queries include tenantId filter
- [ ] JWT contains correct tenantId

### For Transactions

- [ ] Partial failure rolls back completely
- [ ] No orphaned records after error
- [ ] All related data deleted atomically

---

## 📊 Performance Tips

### Use Composite Indexes

```typescript
// For common tenant + filter queries
tenantStatusIdx: index("items_tenant_status_idx").on(t.tenantId, t.status)
```

### Avoid N+1 Queries

```typescript
// ❌ Bad - N+1 query
for (const user of users) {
  user.appointments = await appointmentRepo.findByUserId(user.id);
}

// ✅ Good - single query with join
const usersWithAppointments = await db
  .select()
  .from(users)
  .leftJoin(appointments, eq(appointments.userId, users.id))
  .where(eq(users.tenantId, tenantId));
```

### Use Parallel Queries

```typescript
// ✅ Run independent queries in parallel
const [data, total, relatedCount] = await Promise.all([
  repository.findAll(query, tenantId),
  repository.count(tenantId),
  relatedRepository.count(tenantId),
]);
```

---

## 🔧 Migration Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Check TypeScript
npx tsc --noEmit
```

---

**Remember:** 
- ✅ Always scope by `tenantId`
- ✅ Always check permissions
- ✅ Always log important actions
- ✅ Always use transactions for multi-step operations
- ✅ Always sanitize sensitive data before returning
