export const isAdminRole = (role?: string | null): boolean =>
  role === 'admin' || role === 'superadmin'

export const isStaffRole = (role?: string | null): boolean =>
  role === 'staff' || isAdminRole(role)
