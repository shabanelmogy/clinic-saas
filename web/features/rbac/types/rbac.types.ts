export type Permission = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  createdAt: string;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  clinicId: string | null;
  createdAt: string;
  updatedAt: string;
  permissions?: Permission[];
};

export type CreateRoleInput = {
  name: string;
  description?: string;
  permissionIds: string[];
};

export type UpdateRoleInput = {
  name?: string;
  description?: string;
  permissionIds?: string[];
};

export type AssignRoleInput = {
  staffUserId: string;
  roleId: string;
};
