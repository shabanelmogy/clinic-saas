# Testing Quick Start

Quick reference for writing tests in this project.

---

## 🚀 Run Tests

```bash
cd api

# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## 📝 Write a New Test

### 1. Create test file next to source file
```
src/modules/example/
├── example.service.ts
└── example.service.test.ts  ← Create this
```

### 2. Use this template

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { exampleService } from "./example.service.js";
import { mockT } from "../../tests/setup.js";
import { createMockContext } from "../../tests/factories.js";

// Mock dependencies
vi.mock("./example.repository.js");

describe("ExampleService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("methodName", () => {
    it("should do something when conditions are met", async () => {
      // Arrange - Set up test data
      const input = { name: "Test" };
      const context = createMockContext();

      // Act - Execute the function
      const result = await exampleService.methodName(input, context, mockT);

      // Assert - Verify the result
      expect(result).toEqual({ success: true });
    });

    it("should throw error when validation fails", async () => {
      // Arrange
      const invalidInput = { name: "" };
      const context = createMockContext();

      // Act & Assert
      await expect(
        exampleService.methodName(invalidInput, context, mockT)
      ).rejects.toThrow("validation error");
    });
  });
});
```

---

## 🛠️ Test Utilities

### Mock Translation
```typescript
import { mockT } from "../../tests/setup.js";

// Use in tests
const error = mockT("auth.invalidCredentials");
// Returns: "auth.invalidCredentials"
```

### Test Data Factories
```typescript
import {
  createMockStaffUser,
  createMockClinic,
  createMockPatient,
  createMockDoctor,
  createMockAppointment,
  createMockContext,
} from "../../tests/factories.js";

// Create with defaults
const user = createMockStaffUser();

// Override specific fields
const inactiveUser = createMockStaffUser({ isActive: false });

// Create context for service methods
const context = createMockContext({
  userType: "staff",
  clinicId: "clinic-123",
  permissions: ["appointments:create"],
});
```

### Mock Repository
```typescript
import { vi } from "vitest";
import { exampleRepository } from "./example.repository.js";

// Mock the entire module
vi.mock("./example.repository.js");

// Set return value for a method
vi.mocked(exampleRepository.findById).mockResolvedValue(mockData);

// Verify method was called
expect(exampleRepository.findById).toHaveBeenCalledWith("id-123");
```

---

## ✅ Test Checklist

When writing tests, cover:

- [ ] **Happy path** - Normal successful execution
- [ ] **Validation errors** - Invalid input handling
- [ ] **Not found** - Entity doesn't exist
- [ ] **Permissions** - User lacks required permission
- [ ] **Multi-tenant** - Cross-clinic access prevention
- [ ] **Soft-delete** - Deleted entities excluded
- [ ] **Edge cases** - Empty lists, null values, etc.

---

## 🎯 Priority Areas

Focus testing efforts on:

1. **Authentication** - Login, refresh, logout
2. **Authorization** - Permission checks, RBAC
3. **Multi-tenant isolation** - Clinic data separation
4. **Business logic** - Appointments, patients, doctors
5. **Data validation** - Input validation, constraints

---

## 📊 Coverage

Check coverage after adding tests:

```bash
npm run test:coverage
```

**Current targets:**
- Statements: 70%
- Branches: 65%
- Functions: 70%
- Lines: 70%

---

## 🔍 Example: Testing Multi-Tenant Isolation

```typescript
it("should prevent staff from accessing other clinic's data", async () => {
  // Arrange
  const clinicAContext = createMockContext({
    userType: "staff",
    clinicId: "clinic-a",
    permissions: ["appointments:view_all"],
  });

  const clinicBAppointmentId = "appointment-in-clinic-b";

  // Act & Assert
  await expect(
    appointmentService.getById(clinicBAppointmentId, clinicAContext, mockT)
  ).rejects.toThrow("Appointment not found");
  
  // Note: Returns "not found" not "forbidden" to avoid info leak
});
```

---

## 🔍 Example: Testing Permission Checks

```typescript
it("should require permission to create appointment", async () => {
  // Arrange
  const contextWithoutPermission = createMockContext({
    permissions: ["appointments:view_own"], // Missing "appointments:create"
  });

  // Act & Assert
  await expect(
    appointmentService.create(input, contextWithoutPermission, mockT)
  ).rejects.toThrow(ForbiddenError);
});
```

---

## 📚 More Info

- **Full Guide:** `TESTING_GUIDE.md`
- **Status:** `TESTING_IMPLEMENTATION_STATUS.md`
- **Factories:** `src/tests/factories.ts`
- **Setup:** `src/tests/setup.ts`

---

**Last Updated:** 2026-04-19
