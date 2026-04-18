# Updates Needed for `.kiro/steering/new-module.md`

## Current Architecture (Marketplace Model)

The system now uses a **marketplace + multi-tenant hybrid architecture**:

### 🌍 Global Entities (NO `clinicId`)
- **Users** - Global, email is globally unique
- **Auth tokens** - Reference global users

### 🏢 Clinic-Owned Entities (HAVE `clinicId`)
- **Clinics** - Tenant entities
- **Appointments** - Hybrid (have both `patientId` and `clinicId`)
- **Future clinic-specific data** (staff, services, schedules, etc.)

### 🔄 Hybrid Entities (Context-Aware)
- **Appointments** - Special case with dual-access pattern:
  - Patients: Cross-clinic visibility (filter by `patientId` only)
  - Staff: Clinic-scoped visibility (filter by `clinicId` always)

---

## ❌ Sections to DELETE from new-module.md

### 1. Remove "ALWAYS include clinicId" Rule
**Current (WRONG):**
```markdown
- [ ] **ALWAYS include `clinicId` column:** `clinicId: uuid("clinic_id").notNull()` for multi-tenant isolation
```

**Should be:**
```markdown
- [ ] **Determine if entity is global or clinic-owned:**
  - Global entities (users, auth): NO `clinicId`
  - Clinic-owned entities (services, schedules): HAVE `clinicId`
  - Hybrid entities (appointments): Special dual-access pattern
```

### 2. Remove "ALWAYS add index on clinicId"
**Current (WRONG):**
```markdown
- [ ] **ALWAYS add index on `clinicId`:** `clinicIdx: index("<table>_clinic_idx").on(t.clinicId)`
```

**Should be:**
```markdown
- [ ] **Add index on `clinicId` ONLY for clinic-owned entities**
- [ ] For hybrid entities, add composite indexes for both access patterns
```

### 3. Remove "ALWAYS accept clinicId parameter"
**Current (WRONG):**
```markdown
- [ ] **CRITICAL: ALL repository methods MUST accept `clinicId` parameter and filter by it**
```

**Should be:**
```markdown
- [ ] **Repository methods depend on entity type:**
  - Global entities: NO `clinicId` parameter
  - Clinic-owned entities: ALWAYS accept `clinicId` parameter
  - Hybrid entities: Context-aware methods (see appointments example)
```

### 4. Remove "Email uniqueness is per clinic"
**Current (WRONG):**
```markdown
4. **Email/username uniqueness is per clinic**
```

**Should be:**
```markdown
4. **Email uniqueness depends on entity type:**
   - Users: Globally unique (no clinic filter)
   - Clinic-specific entities: Unique per clinic
```

### 5. Update Multi-Tenant Repository Pattern
**Current pattern assumes ALL entities have `clinicId`**

**Should have THREE patterns:**
1. **Global Repository Pattern** (users, auth)
2. **Clinic-Owned Repository Pattern** (services, schedules)
3. **Hybrid Repository Pattern** (appointments - dual access)

---

## ✅ Sections to ADD to new-module.md

### 1. Add "Entity Type Decision Tree"

```markdown
## 0. Determine Entity Type

Before creating a module, determine the entity type:

### Global Entities
**When to use:** Entity is shared across all clinics
- Users (patients can interact with multiple clinics)
- Authentication tokens
- System-wide settings

**Characteristics:**
- NO `clinicId` column
- Email/username is globally unique
- Repository methods have NO `clinicId` parameter
- Service methods have NO `clinicId` parameter

### Clinic-Owned Entities
**When to use:** Entity belongs to a single clinic
- Services offered by clinic
- Staff members
- Clinic schedules
- Clinic settings

**Characteristics:**
- HAVE `clinicId` column
- Always filtered by `clinicId`
- Repository methods ALWAYS accept `clinicId` parameter
- Service methods ALWAYS accept `clinicId` parameter

### Hybrid Entities (Advanced)
**When to use:** Entity connects global and clinic-owned entities
- Appointments (connect patients to clinics)

**Characteristics:**
- HAVE both `patientId` (global) and `clinicId` (clinic-owned)
- Dual-access pattern (patient vs staff)
- Context-aware repository methods
- Context-aware service methods
```

### 2. Add "Context-Aware Service Pattern"

```markdown
## Context-Aware Service Pattern (Hybrid Entities)

For entities like appointments that need different access patterns:

```ts
export const appointmentService = {
  async listAppointments(
    query: ListQuery,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;  // undefined for patients
      permissions: string[];
    },
    t: TranslateFn
  ) {
    if (context.userType === "patient") {
      // Patient: cross-clinic visibility
      return await appointmentRepository.findAllForPatient(
        context.userId,
        query
      );
    } else {
      // Staff: clinic-scoped visibility
      return await appointmentRepository.findAllForClinic(
        context.clinicId!,
        query
      );
    }
  },
};
```
```

### 3. Add "JWT Payload Variations"

```markdown
## JWT Payload Structure

### Patient Token (Global User)
```json
{
  "userId": "uuid",
  "email": "patient@example.com",
  "userType": "patient",
  "permissions": ["appointments:create", "appointments:view_own"]
}
```

### Staff Token (Clinic-Scoped User)
```json
{
  "userId": "uuid",
  "clinicId": "uuid",
  "email": "doctor@clinic.com",
  "userType": "staff",
  "permissions": ["appointments:view_all", "appointments:create"]
}
```
```

---

## 📝 Recommended Actions

1. **Create new file:** `.kiro/steering/new-module-marketplace.md`
   - Include entity type decision tree
   - Include all three repository patterns
   - Include context-aware service pattern

2. **Update existing file:** `.kiro/steering/new-module.md`
   - Add warning at top: "⚠️ This checklist is for CLINIC-OWNED entities only"
   - Add link to marketplace version for global/hybrid entities

3. **Or replace entirely:** Delete old file, use new marketplace-aware version

---

## 🎯 Key Principle

**The new architecture is NOT "always multi-tenant"**

It's a **hybrid architecture**:
- Some entities are GLOBAL (users)
- Some entities are CLINIC-OWNED (services)
- Some entities are HYBRID (appointments)

The checklist must reflect this reality, not assume everything has `clinicId`.

---

**Date:** 2026-04-18  
**Status:** Documentation update needed
