# Steering File Updated with Localization Guidelines ✅

**Date:** 2026-04-18  
**Status:** ✅ Complete

---

## Summary

Successfully added comprehensive localization (i18n) guidelines to the new-module steering file (`.kiro/steering/new-module.md`). The localization section is now part of the standard module creation checklist.

---

## Changes Made

### Added Section 7: Localization (i18n)

**Location:** After section 6 (Routes) and before section 8 (Register the module)

**Content includes:**

1. **Overview**
   - Supported languages (5 languages)
   - Language detection via HTTP headers
   - Translation function pattern

2. **Step 1: Validation Layer — Factory Function Pattern**
   - `TranslateFn` type definition
   - Factory function pattern: `createSchemas(t: TranslateFn)`
   - Replace hardcoded messages with translation keys
   - Type exports using factory return types
   - Common validation translation keys

3. **Step 2: Service Layer — Translation Parameter**
   - Add `TranslateFn` type import
   - Update `requirePermission()` helper
   - Add `t: TranslateFn` parameter to all methods
   - Replace hardcoded error messages
   - Common service translation keys

4. **Step 3: Controller Layer — Pass Translation Function**
   - Pass `req.t` to all service calls
   - Use `req.t()` for success messages
   - Complete controller examples

5. **Step 4: Routes Layer — Use Factory Functions**
   - Import factory function instead of static schemas
   - Use factory functions in validation middleware
   - Pattern: `validate({ body: (t) => createSchemas(t).create })`

6. **Step 5: Add Translation Keys to Locale Files**
   - Add keys to all 5 language files
   - Example translation structure
   - Reuse existing validation keys

7. **Localization Checklist**
   - 13 checkpoints covering all layers
   - Verification steps

8. **Testing Localization**
   - Test commands for all 5 languages
   - Expected behavior

9. **Common Mistakes to Avoid**
   - ❌ Wrong patterns with hardcoded messages
   - ✅ Correct patterns with translation keys
   - Side-by-side comparisons

10. **Documentation References**
    - Links to localization documentation
    - Example modules with localization

---

## Updated Section Numbers

All subsequent sections were renumbered:
- Section 7: **Localization (i18n)** ← NEW
- Section 8: Register the module (was 7)
- Section 9: RBAC System Integration (was 8)
- Section 10: Multi-Tenant Architecture (was 9)
- Section 11: Structured Logging (was 10)
- Section 12: Transaction Safety (was 11)
- Section 13: Final checklist before committing (was 12)
- Section 14: Testing Checklist (was 13)

---

## Updated Checklists

### Section 13: Final Checklist — Added Localization

```markdown
### Localization
- [ ] Validation factory function created with `TranslateFn` parameter
- [ ] All validation error messages use translation keys
- [ ] Service methods accept `t: TranslateFn` parameter
- [ ] All service error messages use translation keys
- [ ] Controller methods pass `req.t` to service
- [ ] Routes use factory functions: `(t) => createSchemas(t).create`
- [ ] Translation keys added to all 5 language files (en, ar, fr, es, de)
- [ ] Tested with different language headers
```

### Section 14: Testing Checklist — Added Localization

```markdown
### Localization
- [ ] Validation errors appear in requested language
- [ ] Service errors appear in requested language
- [ ] Success messages appear in requested language
- [ ] Fallback to English works when translation missing
- [ ] All 5 languages tested (en, ar, fr, es, de)
```

---

## Quick Reference — Added Localization

Added localization pattern to the Quick Reference section:

```typescript
// Validation with translation
name: z.string().min(2, t("validation.minLength", { field: "Name", min: 2 }))

// Service with translation
throw new NotFoundError(t("items.notFound"));

// Controller with translation
sendSuccess(res, result, req.t("items.retrieved"));

// Routes with factory function
validate({ body: (t) => createItemSchemas(t).create })
```

---

## Documentation References — Updated

Added localization documentation reference:

```markdown
- **Localization:** `api/LOCALIZATION_FINAL_STATUS.md` - Complete i18n documentation
```

---

## Status Line — Updated

Changed from:
```markdown
**Status:** ✅ Production-ready module checklist with RBAC and multi-tenant support
```

To:
```markdown
**Status:** ✅ Production-ready module checklist with RBAC, multi-tenant support, and localization
```

---

## Complete Localization Pattern

The steering file now includes the complete pattern for implementing localization in new modules:

### 1. Validation (Factory Function)
```typescript
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const createItemSchemas = (t: TranslateFn) => ({
  create: z.object({
    name: z.string().min(2, t("validation.minLength", { field: "Name", min: 2 })),
  }),
  update: z.object({
    name: z.string().min(2, t("validation.minLength", { field: "Name", min: 2 })).optional(),
  }),
  listQuery: paginationSchema.extend({
    // filters
  }),
});

export type CreateItemInput = z.infer<ReturnType<typeof createItemSchemas>["create"]>;
```

### 2. Service (Translation Parameter)
```typescript
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const requirePermission = (
  userPermissions: string[],
  permission: string,
  t: TranslateFn
): void => {
  if (!userPermissions.includes(permission)) {
    throw new ForbiddenError(t("permissions.required", { permission }));
  }
};

export const itemService = {
  async createItem(
    input: CreateInput,
    requestingUserId: string,
    requestingUserPermissions: string[],
    clinicId: string,
    t: TranslateFn  // ← Translation parameter
  ) {
    requirePermission(requestingUserPermissions, "items:create", t);
    
    if (existing) {
      throw new ConflictError(t("items.nameExists"));
    }
    
    if (!user) throw new NotFoundError(t("items.userNotFound"));
  },
};
```

### 3. Controller (Pass req.t)
```typescript
export const itemController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await itemService.createItem(
        req.body,
        req.user!.userId,
        req.user!.permissions,
        req.user!.clinicId,
        req.t  // ← Pass translation function
      );
      sendCreated(res, result, req.t("items.created"));
    } catch (err) {
      next(err);
    }
  },
};
```

### 4. Routes (Factory Functions)
```typescript
import { createItemSchemas } from "./item.validation.js";

router.post(
  "/",
  authenticate,
  authorize("items:create"),
  validate({ body: (t) => createItemSchemas(t).create }),  // ← Factory function
  itemController.create
);
```

### 5. Locale Files (Translation Keys)
```json
{
  "items": {
    "retrieved": "Items retrieved",
    "created": "Item created successfully",
    "notFound": "Item not found",
    "nameExists": "An item with that name already exists in this clinic",
    "userNotFound": "User not found"
  }
}
```

---

## Benefits

### For Developers
- ✅ Clear step-by-step localization guide
- ✅ Complete code examples for all layers
- ✅ Common mistakes highlighted
- ✅ Checklist ensures nothing is missed
- ✅ Testing instructions included

### For Code Quality
- ✅ Consistent localization pattern across all modules
- ✅ Type-safe translation functions
- ✅ No hardcoded English messages
- ✅ Multi-language support from day one

### For Users
- ✅ All new modules support 5 languages
- ✅ Consistent error messages
- ✅ Better user experience for non-English speakers

---

## File Modified

**File:** `.kiro/steering/new-module.md`
**Lines Added:** ~450 lines
**New Section:** Section 7 - Localization (i18n)
**Updated Sections:** 8-14 (renumbered)

---

## Verification

### File Structure
```bash
# Check section exists
Select-String -Pattern "## 7. Localization" -Path .kiro/steering/new-module.md
# Result: Line 912 ✅
```

### Content Includes
- ✅ 5 step-by-step implementation guide
- ✅ Complete code examples for all layers
- ✅ Translation key examples
- ✅ Localization checklist (13 items)
- ✅ Testing instructions
- ✅ Common mistakes section
- ✅ Documentation references

---

## Next Steps

When creating a new module, developers will now:

1. Follow sections 1-6 (Schema, Validation, Repository, Service, Controller, Routes)
2. **Follow section 7 (Localization)** ← NEW
3. Follow section 8 (Register module)
4. Follow sections 9-12 (RBAC, Multi-tenant, Logging, Transactions)
5. Complete checklist in section 13 (including localization)
6. Test using section 14 (including localization tests)

---

## Impact

### Immediate
- All new modules will include localization from the start
- No need to retrofit localization later
- Consistent pattern across entire codebase

### Long-term
- Easier to add new languages
- Better international user experience
- Reduced technical debt
- Faster development (pattern is documented)

---

**Status:** ✅ Steering file successfully updated with comprehensive localization guidelines
