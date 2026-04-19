# Testing Guide - Healthcare SaaS API

Complete guide for testing the multi-tenant healthcare SaaS backend.

---

## 🚀 Quick Start

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# View coverage report
start coverage/index.html  # Windows
open coverage/index.html   # Mac
```

---

## 📁 Test Structure

```
api/src/
├── modules/
│   ├── auth/
│   │   ├── auth.service.ts
│   │   └── auth.service.test.ts       ← Unit tests
│   ├── appointments/
│   │   ├── appointment.service.ts
│   │   └── appointment.service.test.ts
│   └── users/
│       ├── user.service.ts
│       └── user.service.test.ts
├── middlewares/
│   ├── auth.middleware.ts
│   └── auth.middleware.test.ts
└── utils/
    ├── jwt.ts
    └── jwt.test.ts
```

---

## 🧪 Test Types

### 1. Unit Tests
Test individual functions/methods in isolation.

**What to test:**
- Service methods (business logic)
- Utility functions
- Validation schemas
- Error handling

**Example:** `auth.service.test.ts`

### 2. Integration Tests
Test multiple components working together.

**What to test:**
- Repository + Database
- Service + Repository
- Controller + Service + Repository

**Example:** `appointment.integration.test.ts`

### 3. E2E Tests (Future)
Test complete user flows through HTTP endpoints.

**What to test:**
- Login → Create appointment → View appointment
- Multi-tenant isolation
- Permission checks

---

## 📝 Writing Tests

### Test File Naming
- Unit tests: `<name>.test.ts` (same folder as source)
- Integration tests: `<name>.integration.test.ts`
- E2E tests: `<name>.e2e.test.ts`

### Test Structure (AAA Pattern)

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("AuthService", () => {
  describe("login", () => {
    it("should return tokens for valid credentials", async () => {
      // Arrange - Set up test data and mocks
      const email = "doctor@clinic.com";
      const password = "SecurePass1";
      
      // Act - Execute the function
      const result = await authService.login(email, password);
      
      // Assert - Verify the result
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    it("should throw error for invalid password", async () => {
      // Arrange
      const email = "doctor@clinic.com";
      const password = "WrongPassword";
      
      // Act & Assert
      await expect(
        authService.login(email, password)
      ).rejects.toThrow("Invalid credentials");
    });
  });
});
```

---

## 🎯 Priority Test Areas

Based on your architecture, prioritize testing:

### 1. **Authentication & Authorization** (CRITICAL)
- ✅ Login with valid/invalid credentials
- ✅ Token refresh and rotation
- ✅ Token family revocation on reuse
- ✅ Logout and logout-all
- ✅ Permission checks in middleware

### 2. **Multi-Tenant Isolation** (CRITICAL)
- ✅ Staff from Clinic A cannot access Clinic B data
- ✅ Patients belong to correct clinic
- ✅ Appointments scoped to clinic
- ✅ Cross-tenant data leak prevention

### 3. **Appointment Booking** (HIGH)
- ✅ Prevent double-booking (same doctor, same time)
- ✅ Slot availability check
- ✅ Patient can book with any clinic
- ✅ Staff can only book for their clinic

### 4. **RBAC** (HIGH)
- ✅ Global roles vs clinic-scoped roles
- ✅ Permission aggregation from multiple roles
- ✅ Permission checks in services

### 5. **Soft-Delete** (MEDIUM)
- ✅ Deleted records excluded from queries
- ✅ Unique constraints work with soft-delete
- ✅ Cascade behavior on soft-deleted parents

### 6. **Data Validation** (MEDIUM)
- ✅ Zod schemas reject invalid input
- ✅ Translation keys work correctly
- ✅ Enum values validated

---

## 🛠️ Testing Utilities

### Mock Database

```typescript
// tests/setup.ts
import { vi } from "vitest";

export const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};
```

### Mock Translation Function

```typescript
export const mockT = (key: string, params?: Record<string, any>) => {
  // Simple mock - returns the key
  return key;
};
```

### Test Data Factories

```typescript
// tests/factories.ts
import { v4 as uuid } from "uuid";

export const createMockStaffUser = (overrides = {}) => ({
  id: uuid(),
  name: "Dr. John Doe",
  email: "doctor@clinic.com",
  passwordHash: "$2b$12$...",
  phone: "+1234567890",
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockAppointment = (overrides = {}) => ({
  id: uuid(),
  clinicId: uuid(),
  patientId: uuid(),
  doctorId: uuid(),
  title: "Consultation",
  scheduledAt: new Date(),
  durationMinutes: 60,
  status: "pending" as const,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockContext = (overrides = {}) => ({
  userType: "staff" as const,
  userId: uuid(),
  clinicId: uuid(),
  permissions: ["appointments:view_all", "appointments:create"],
  ...overrides,
});
```

---

## 📋 Example Tests

### Example 1: Service Unit Test

```typescript
// src/modules/auth/auth.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { authService } from "./auth.service";
import { UnauthorizedError } from "../../utils/errors";

// Mock dependencies
vi.mock("./auth.repository");
vi.mock("../rbac/rbac.repository");
vi.mock("bcrypt");

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("should return tokens for valid credentials", async () => {
      // Test implementation
    });

    it("should throw UnauthorizedError for invalid password", async () => {
      // Test implementation
    });

    it("should throw UnauthorizedError for inactive user", async () => {
      // Test implementation
    });

    it("should throw UnauthorizedError for deleted user", async () => {
      // Test implementation
    });
  });

  describe("refresh", () => {
    it("should issue new tokens for valid refresh token", async () => {
      // Test implementation
    });

    it("should revoke family on reused token", async () => {
      // Test implementation
    });

    it("should throw error for expired token", async () => {
      // Test implementation
    });
  });
});
```

### Example 2: Multi-Tenant Isolation Test

```typescript
// src/modules/appointments/appointment.service.test.ts
import { describe, it, expect } from "vitest";
import { appointmentService } from "./appointment.service";
import { ForbiddenError } from "../../utils/errors";

describe("AppointmentService - Multi-Tenant Isolation", () => {
  it("should prevent staff from accessing other clinic's appointments", async () => {
    const clinicAContext = {
      userType: "staff" as const,
      userId: "staff-a",
      clinicId: "clinic-a",
      permissions: ["appointments:view_all"],
    };

    const clinicBAppointmentId = "appointment-in-clinic-b";

    // Should throw NotFoundError (not ForbiddenError to avoid info leak)
    await expect(
      appointmentService.getAppointmentById(
        clinicBAppointmentId,
        clinicAContext,
        mockT
      )
    ).rejects.toThrow("Appointment not found");
  });

  it("should allow patient to see appointments across all clinics", async () => {
    const patientContext = {
      userType: "patient" as const,
      userId: "patient-1",
      clinicId: undefined,
      permissions: ["appointments:view_own"],
    };

    const result = await appointmentService.listAppointments(
      { page: 1, limit: 10 },
      patientContext,
      mockT
    );

    // Should return appointments from multiple clinics
    expect(result.data).toHaveLength(3);
    expect(new Set(result.data.map(a => a.clinicId)).size).toBeGreaterThan(1);
  });
});
```

### Example 3: Permission Check Test

```typescript
// src/modules/rbac/authorize.middleware.test.ts
import { describe, it, expect } from "vitest";
import { authorize } from "./authorize.middleware";
import { ForbiddenError } from "../../utils/errors";

describe("authorize middleware", () => {
  it("should allow request with required permission", () => {
    const req = {
      user: {
        userId: "user-1",
        permissions: ["appointments:create", "appointments:view_all"],
      },
    };

    const middleware = authorize("appointments:create");
    
    expect(() => middleware(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it("should reject request without required permission", () => {
    const req = {
      user: {
        userId: "user-1",
        permissions: ["appointments:view_own"],
      },
    };

    const middleware = authorize("appointments:delete");
    
    expect(() => middleware(req, res, next)).toThrow(ForbiddenError);
  });
});
```

### Example 4: Soft-Delete Test

```typescript
// src/modules/patients/patient.repository.test.ts
import { describe, it, expect } from "vitest";
import { patientRepository } from "./patient.repository";

describe("PatientRepository - Soft Delete", () => {
  it("should exclude soft-deleted patients from findAll", async () => {
    const clinicId = "clinic-1";
    
    // Create 2 active + 1 deleted patient
    await createPatient({ clinicId, deletedAt: null });
    await createPatient({ clinicId, deletedAt: null });
    await createPatient({ clinicId, deletedAt: new Date() });

    const result = await patientRepository.findAll(
      { page: 1, limit: 10 },
      clinicId
    );

    expect(result.data).toHaveLength(2);
    expect(result.data.every(p => p.deletedAt === null)).toBe(true);
  });

  it("should allow duplicate email after soft-delete", async () => {
    const clinicId = "clinic-1";
    const email = "patient@example.com";

    // Create patient
    const patient1 = await patientRepository.create({
      clinicId,
      name: "John Doe",
      email,
    });

    // Soft-delete
    await patientRepository.softDelete(patient1.id, clinicId);

    // Should allow creating new patient with same email
    const patient2 = await patientRepository.create({
      clinicId,
      name: "Jane Doe",
      email,
    });

    expect(patient2.email).toBe(email);
    expect(patient2.id).not.toBe(patient1.id);
  });
});
```

---

## 🎯 Coverage Goals

Set minimum coverage thresholds in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

---

## 🚨 Common Testing Mistakes

### ❌ Don't Test Implementation Details
```typescript
// BAD - testing internal implementation
it("should call bcrypt.compare", async () => {
  await authService.login(email, password);
  expect(bcrypt.compare).toHaveBeenCalled();
});

// GOOD - testing behavior
it("should return tokens for valid credentials", async () => {
  const result = await authService.login(email, password);
  expect(result).toHaveProperty("accessToken");
});
```

### ❌ Don't Use Real Database in Unit Tests
```typescript
// BAD - hits real database
it("should create appointment", async () => {
  const result = await db.insert(appointments).values(...);
});

// GOOD - mock the repository
it("should create appointment", async () => {
  vi.mocked(appointmentRepository.create).mockResolvedValue(mockAppointment);
  const result = await appointmentService.createAppointment(...);
});
```

### ❌ Don't Test Multiple Things in One Test
```typescript
// BAD - tests too many things
it("should handle complete appointment flow", async () => {
  const appointment = await create();
  await update(appointment.id);
  await delete(appointment.id);
  // Too much!
});

// GOOD - separate tests
it("should create appointment", async () => { ... });
it("should update appointment", async () => { ... });
it("should delete appointment", async () => { ... });
```

---

## 📚 Resources

- **Vitest Docs:** https://vitest.dev/
- **Testing Best Practices:** https://testingjavascript.com/
- **Test Data Builders:** https://www.arhohuttunen.com/test-data-builders/

---

## 🎯 Next Steps

1. **Create test setup file:** `tests/setup.ts`
2. **Add test factories:** `tests/factories.ts`
3. **Write first test:** `src/modules/auth/auth.service.test.ts`
4. **Run tests:** `npm test`
5. **Check coverage:** `npm run test:coverage`
6. **Iterate:** Add more tests for critical paths

---

**Date:** 2026-04-19  
**Status:** Ready to implement
