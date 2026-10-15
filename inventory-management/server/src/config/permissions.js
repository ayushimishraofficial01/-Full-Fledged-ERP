const PERMISSIONS = Object.freeze([
  'dashboard.view',
  'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import', 'products.export',
  'warehouses.view', 'warehouses.create', 'warehouses.edit', 'warehouses.delete',
  'production.view', 'production.create', 'production.edit', 'production.delete', 'production.transfer',
  'inventory.view', 'inventory.export',
  'stock.in', 'stock.out', 'stock.transfer', 'stock.history',
  'scanner.view', 'scanner.scan', 'barcode.generate', 'barcode.print', 'qr.generate', 'qr.print',
  'reports.view', 'reports.export',
  'users.view', 'users.create', 'users.edit', 'users.disable', 'users.delete',
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
  'settings.view', 'settings.edit',
  'audit.view',
  'crm.view', 'crm.dashboard.view',
  'sales_visits.view', 'sales_visits.track', 'sales_overview.view',
  'sales_expenses.view', 'sales_expenses.create',
  'billing.view', 'billing.manage',
  'orders.view', 'orders.create', 'orders.edit',
  'customers.view', 'customers.lookup', 'customers.create', 'customers.edit', 'customers.delete', 'customers.archive', 'customers.import', 'customers.export',
  'leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'leads.convert', 'leads.import', 'leads.export',
  'companies.view', 'companies.create', 'companies.edit', 'companies.delete',
  'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete',
  'followups.view', 'followups.create', 'followups.edit', 'followups.delete',
  'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete',
  'interactions.view', 'interactions.create', 'interactions.edit', 'interactions.delete',
  'notes.view', 'notes.create', 'notes.edit', 'notes.delete',
  'sample_dispatch.view', 'sample_dispatch.create', 'sample_dispatch.edit', 'sample_dispatch.delete', 'sample_dispatch.export',
  'crm.reports.view', 'crm.reports.export',
  'hr.dashboard.view',
  'hr.employees.view', 'hr.employees.create', 'hr.employees.edit',
  'hr.departments.manage',
  'hr.attendance.view', 'hr.attendance.edit',
  'hr.leaves.view', 'hr.leaves.apply', 'hr.leaves.approve',
  'hr.payroll.view', 'hr.payroll.manage',
  'hr.reports.view',
]);

const EMPLOYEE_HR_PERMISSIONS = [
  'hr.dashboard.view',
  'hr.employees.view',
  'hr.attendance.view',
  'hr.leaves.view',
  'hr.leaves.apply',
];

const MANAGER_HR_PERMISSIONS = [
  ...EMPLOYEE_HR_PERMISSIONS,
  'hr.employees.edit',
  'hr.attendance.edit',
  'hr.reports.view',
];

const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  admin: [...PERMISSIONS],
  manager: [
    ...PERMISSIONS.filter((permission) =>
      !permission.startsWith('users.') &&
      !permission.startsWith('roles.') &&
      !permission.startsWith('settings.') &&
      permission !== 'audit.view' &&
      permission !== 'sales_overview.view' &&
      !permission.startsWith('hr.')
    ),
    ...MANAGER_HR_PERMISSIONS,
  ],
  user: [
    'dashboard.view', 'products.view', 'warehouses.view', 'inventory.view',
    'stock.history', 'scanner.view', 'scanner.scan',
    'sales_visits.track', 'sales_expenses.view', 'sales_expenses.create', 'orders.view', 'orders.create', 'customers.lookup',
    ...EMPLOYEE_HR_PERMISSIONS,
  ],
  sales: ['dashboard.view', 'sales_visits.track', 'sales_expenses.view', 'sales_expenses.create', 'orders.view', 'orders.create', 'customers.lookup', ...EMPLOYEE_HR_PERMISSIONS],
});

function normalizeRole(role) {
  return role === 'staff' ? 'user' : String(role || '').toLowerCase();
}

module.exports = { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, EMPLOYEE_HR_PERMISSIONS, MANAGER_HR_PERMISSIONS, normalizeRole };
