# 📋 Marketplace Refactoring - Executive Summary

**Date:** 2026-04-18  
**Architect:** Senior Backend Architect  
**Status:** 📋 Planning Complete - Ready for Implementation

---

## 🎯 Objective

Transform the current **single-tenant clinic SaaS** into a **hybrid marketplace + multi-tenant platform** where:

- **Patients** are global users who can interact with ANY clinic
- **Clinics** remain completely isolated from each other
- **Public marketplace** allows browsing clinics without authentication

---

## 📊 Key Changes

### 1. Data Model

| Table | Before | After |
|-------|--------|-------|
| **users** | Has `clinic_id` (tenant-scoped) | NO `clinic_id` (global) |
| **clinics** | Doesn't exist | NEW table for clinic entities |
| **clinic_staff** | Doesn't exist | NEW table for employees (replaces old users) |
| **appointments** | `user_id` references tenant-scoped users | `patient_id` references global users + `clinic_id` |

### 2. Access Patterns

| User Type | Access Pattern | Filter |
|-----------|---------------|--------|
| **Patient** | Cross-clinic | `patientId` ONLY (no `clinicId`) |
| **Staff** | Clinic-scoped | ALWAYS filter by `clinicId` |
| **Public** | Marketplace | Only `isPublished = true` clinics |

### 3. API Structure

```
/api/public/clinics          # Public marketplace (no auth)
/api/public/doctors          # Browse doctors (no auth)
/api/v1/appointments         # Context-aware (patient vs staff)
/api/v1/users                # Patient profiles
```

---

## 📁 New Folder Structure

```
api/src/modules/
├── public/                  # 🌍 PUBLIC MARKETPLACE
│   ├── clinics/
│   ├── doctors/
│   └── availability/
│
├── users/                   # 👤 GLOBAL USERS (patients)
├── clinics/                 # 🏥 CLINIC MANAGEMENT
├── appointments/            # 📅 HYBRID ACCESS
├── auth/                    # 🔐 AUTHENTICATION
└── rbac/                    # 🛡️ AUTHORIZATION
```

---

## 🔑 Core Principles

### ✅ Patient Queries (Cross-Clinic)

```typescript
// ✅ CORRECT - No clinic filter
const appointments = await db
  .select()
  .from(appointments)
  .where(eq(appointments.patientId, patientId));
```

### ✅ Staff Queries (Clinic-Scoped)

```typescript
// ✅ CORRECT - Always filter by clinic
const appointments = await db
  .select()
  .from(appointments)
  .where(and(
    eq(appointments.clinicId, clinicId),
    eq(appointments.status, "pending")
  ));
```

### ✅ Public Queries (Marketplace)

```typescript
// ✅ CORRECT - Only published clinics
const clinics = await db
  .select()
  .from(clinics)
  .where(and(
    eq(clinics.isPublished, true),
    eq(clinics.isActive, true)
  ));
```

---

## 🔄 Migration Steps

### Phase 1: Database (2-3 hours)
1. Create `clinics` table
2. Create `clinic_staff` table
3. Migrate existing users to `clinic_staff`
4. Recreate `users` table (global)
5. Update `appointments` table

### Phase 2: Code (3-4 hours)
1. Update schema files
2. Create public modules
3. Implement dual-access repositories
4. Update services with context-aware logic
5. Update controllers to extract context
6. Register new routes

### Phase 3: Testing (1-2 hours)
1. Test patient cross-clinic appointments
2. Test clinic isolation
3. Test public marketplace
4. Verify data integrity

---

## 📚 Documentation Created

| Document | Purpose |
|----------|---------|
| **MARKETPLACE_ARCHITECTURE.md** | Complete architecture plan with examples |
| **IMPLEMENTATION_EXAMPLES.md** | Copy-paste ready code examples |
| **MIGRATION_GUIDE.md** | Step-by-step migration instructions |
| **QUICK_REFERENCE_MARKETPLACE.md** | Quick reference for developers |
| **REFACTORING_SUMMARY.md** | This document (executive summary) |

---

## ⚠️ Critical Rules

### DO ✅

- **Patients:** Query by `patientId` ONLY (no `clinicId` filter)
- **Staff:** ALWAYS filter by `clinicId`
- **Public:** Show only `isPublished = true` clinics
- **Context-aware:** Use `userType` to determine access pattern
- **JWT tokens:** Include `userType` field

### DON'T ❌

- **Never** filter patient queries by `clinicId`
- **Never** allow staff to access other clinics' data
- **Never** expose unpublished clinics in public API
- **Never** mix patient and staff logic in the same method
- **Never** trust `clinicId` from request body for staff

---

## 🎯 Benefits

### For Patients
- ✅ Single account for all clinics
- ✅ Browse marketplace without signup
- ✅ Book appointments with any clinic
- ✅ View all appointments in one place

### For Clinics
- ✅ Complete data isolation
- ✅ Marketplace visibility
- ✅ Attract new patients
- ✅ Maintain privacy and security

### For Platform
- ✅ Scalable architecture
- ✅ Clear separation of concerns
- ✅ Easy to add new features
- ✅ Better user experience

---

## 📋 Implementation Checklist

### Database
- [ ] Create `clinics` table
- [ ] Create `clinic_staff` table
- [ ] Migrate data to new tables
- [ ] Update `appointments` table
- [ ] Recreate `users` table (global)
- [ ] Update indexes

### Code Structure
- [ ] Create `modules/public/` folder
- [ ] Update `modules/users/` (remove `clinicId`)
- [ ] Create `modules/clinics/` (management)
- [ ] Update `modules/appointments/` (dual access)

### Repository Layer
- [ ] Implement `findAllForPatient()` (no clinic filter)
- [ ] Implement `findAllForClinic()` (with clinic filter)
- [ ] Implement context-aware `findById()`

### Service Layer
- [ ] Add `userType` to context parameter
- [ ] Implement patient logic (cross-clinic)
- [ ] Implement staff logic (clinic-scoped)

### Controller Layer
- [ ] Extract context from `req.user`
- [ ] Pass context to service methods

### Middleware
- [ ] Update JWT to include `userType`
- [ ] Update auth middleware

### Routes
- [ ] Create public routes (no auth)
- [ ] Update private routes (context-aware)
- [ ] Register routes in `server.ts`

### Testing
- [ ] Test patient cross-clinic appointments
- [ ] Test clinic isolation
- [ ] Test public marketplace
- [ ] Test permission enforcement

---

## 🚀 Next Steps

1. **Review** this plan with the team
2. **Schedule** migration window (4-6 hours)
3. **Backup** database before starting
4. **Execute** Phase 1 (database migration)
5. **Execute** Phase 2 (code refactoring)
6. **Execute** Phase 3 (testing)
7. **Deploy** to production

---

## 📞 Support

For questions or issues during implementation:

1. **Review documentation:**
   - `MARKETPLACE_ARCHITECTURE.md` - Complete architecture
   - `IMPLEMENTATION_EXAMPLES.md` - Code examples
   - `MIGRATION_GUIDE.md` - Migration steps
   - `QUICK_REFERENCE_MARKETPLACE.md` - Quick reference

2. **Check examples:**
   - Patient query pattern
   - Staff query pattern
   - Public query pattern
   - Context-aware logic

3. **Test thoroughly:**
   - Patient cross-clinic access
   - Clinic isolation
   - Public marketplace
   - Permission enforcement

---

## 🎓 Key Takeaways

### Architecture Pattern
- **Global users** (patients) with NO `clinic_id`
- **Tenant-scoped staff** with `clinic_id`
- **Hybrid appointments** with both `patient_id` and `clinic_id`
- **Context-aware** access patterns

### Access Control
- **Patient queries:** Filter by `patientId` ONLY
- **Staff queries:** ALWAYS filter by `clinicId`
- **Public queries:** Only `isPublished = true`

### Implementation
- **Dual-access repositories** (patient vs staff methods)
- **Context-aware services** (branch on `userType`)
- **JWT with userType** (identify patient vs staff)

---

**Status:** ✅ Planning Complete - Ready for Implementation

**Estimated Time:** 6-8 hours total
- Database migration: 2-3 hours
- Code refactoring: 3-4 hours
- Testing: 1-2 hours

**Risk Level:** Medium
- Breaking changes to data model
- Requires careful migration
- Thorough testing needed

**Rollback Plan:** Available in `MIGRATION_GUIDE.md`
