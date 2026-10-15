import api, { cleanParams } from './api';

const get = (url, params) => api.get(url, { params: cleanParams(params) }).then((r) => r.data);

function buildMultipartForm(data = {}, file = null) {
  const form = new FormData();
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    form.append(key, value);
  });
  if (file) form.append('image', file);
  return form;
}

export const authService = {
  me: () => api.get('/auth/me').then((r) => r.data),
  login: (body) => api.post('/auth/login', body).then((r) => r.data),
  register: (body) => api.post('/auth/register', body).then((r) => r.data),
  google: (body) => api.post('/auth/google', body).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  logoutAll: () => api.post('/auth/logout-all').then((r) => r.data),
  forgotPassword: (body) => api.post('/auth/forgot-password', body).then((r) => r.data),
  resetPassword: (token, body) => api.post(`/auth/reset-password/${token}`, body).then((r) => r.data),
  updateProfile: (body) => api.put('/auth/profile', body).then((r) => r.data),
  changePassword: (body) => api.put('/auth/password', body).then((r) => r.data),
};

export const dashboardService = {
  summary: (params) => get('/dashboard/summary', params),
};

export const productService = {
  list: (params) => get('/products', params),
  get: (id) => get(`/products/${id}`),
  categories: () => get('/products/categories'),
  create: (formData) => api.post('/products', formData).then((r) => r.data),
  update: (id, formData) => api.put(`/products/${id}`, formData).then((r) => r.data),
  remove: (id) => api.delete(`/products/${id}`).then((r) => r.data),
  restore: (id) => api.patch(`/products/${id}/restore`).then((r) => r.data),
};

export const warehouseService = {
  list: (params) => get('/warehouses', params),
  all: (params) => get('/warehouses', { ...params, all: 'true' }),
  get: (id) => get(`/warehouses/${id}`),
  create: (body) => api.post('/warehouses', body).then((r) => r.data),
  update: (id, body) => api.put(`/warehouses/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/warehouses/${id}`).then((r) => r.data),
  restore: (id) => api.patch(`/warehouses/${id}/restore`).then((r) => r.data),
};

export const inventoryService = {
  list: (params) => get('/inventory', params),
  byWarehouse: (warehouseId, params) => get(`/inventory/warehouse/${warehouseId}`, params),
  byProduct: (productId) => get(`/inventory/product/${productId}`),
  lowStock: (params) => get('/inventory/low-stock', params),
  available: (product, warehouse) => get('/inventory/available', { product, warehouse }),
};

export const stockService = {
  stockIn: (body) => api.post('/stock/in', body).then((r) => r.data),
  stockOut: (body) => api.post('/stock/out', body).then((r) => r.data),
  transfer: (body) => api.post('/stock/transfer', body).then((r) => r.data),
  transactions: (params) => get('/stock/transactions', params),
  transfers: (params) => get('/stock/transfers', params),
};

export const productionService = {
  dashboard: () => get('/production/dashboard'),
  stock: (params) => get('/production/stock', params),
  available: (productId) => get(`/production/available/${productId}`),
  add: (body) => api.post('/production', body).then((r) => r.data),
  transfer: (body) => api.post('/production/transfer', body).then((r) => r.data),
  history: (params) => get('/production/history', params),
  transfers: (params) => get('/production/transfers', params),
};

export const reportService = {
  inventory: (params) => get('/reports/inventory', params),
  stockIn: (params) => get('/reports/stock-in', params),
  stockOut: (params) => get('/reports/stock-out', params),
  transfers: (params) => get('/reports/transfers', params),
};

export const importService = {
  preview: (file, updateExisting) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('updateExisting', String(Boolean(updateExisting)));
    return api.post('/import/products/preview', fd, { timeout: 180000 }).then((r) => r.data);
  },
  commit: (body) => api.post('/import/products', body, { timeout: 300000 }).then((r) => r.data),
};

export const settingsService = {
  get: () => get('/settings'),
  update: (body) => api.put('/settings', body).then((r) => r.data),
  units: (params) => get('/units', params),
  createUnit: (body) => api.post('/units', body).then((r) => r.data),
  toggleUnit: (id) => api.patch(`/units/${id}/toggle`).then((r) => r.data),
  deleteUnit: (id) => api.delete(`/units/${id}`).then((r) => r.data),
};

export const accessService = {
  users: () => get('/access/users'),
  user: (id) => get(`/access/users/${id}`),
  createUser: (body) => api.post('/access/users', body).then((r) => r.data),
  updateUser: (id, body) => api.put(`/access/users/${id}`, body).then((r) => r.data),
  updateStatus: (id, status) => api.patch(`/access/users/${id}/status`, { status }).then((r) => r.data),
  resetPassword: (id, password) => api.patch(`/access/users/${id}/password`, { password }).then((r) => r.data),
  roles: () => get('/access/roles'),
  permissions: () => get('/access/permissions'),
  createRole: (body) => api.post('/access/roles', body).then((r) => r.data),
  updateRole: (id, body) => api.put(`/access/roles/${id}`, body).then((r) => r.data),
  auditLogs: () => get('/access/audit-logs'),
};

export const crmService = {
  dashboard: () => get('/crm/dashboard'),
  reports: () => get('/crm/reports'),
  activity: () => get('/crm/activity'),
  customers: (params) => get('/crm/customers', params),
  customer: (id) => get(`/crm/customers/${id}`),
  lookupCustomers: (params) => get('/crm/customer-lookup', params),
  customerSampleDispatches: (id) => get(`/crm/customers/${id}/sample-dispatches`),
  createCustomer: (body) => api.post('/crm/customers', body).then((r) => r.data),
  updateCustomer: (id, body) => api.put(`/crm/customers/${id}`, body).then((r) => r.data),
  archiveCustomer: (id) => api.patch(`/crm/customers/${id}/archive`).then((r) => r.data),
  leads: (params) => get('/crm/leads', params),
  lead: (id) => get(`/crm/leads/${id}`),
  createLead: (body) => api.post('/crm/leads', body).then((r) => r.data),
  updateLead: (id, body) => api.put(`/crm/leads/${id}`, body).then((r) => r.data),
  convertLead: (id) => api.post(`/crm/leads/${id}/convert`).then((r) => r.data),
  companies: (params) => get('/crm/companies', params),
  company: (id) => get(`/crm/companies/${id}`),
  createCompany: (body) => api.post('/crm/companies', body).then((r) => r.data),
  updateCompany: (id, body) => api.put(`/crm/companies/${id}`, body).then((r) => r.data),
  contacts: (params) => get('/crm/contacts', params),
  contact: (id) => get(`/crm/contacts/${id}`),
  createContact: (body) => api.post('/crm/contacts', body).then((r) => r.data),
  updateContact: (id, body) => api.put(`/crm/contacts/${id}`, body).then((r) => r.data),
  followUps: (params) => get('/crm/followups', params),
  createFollowUp: (body) => api.post('/crm/followups', body).then((r) => r.data),
  updateFollowUp: (id, body) => api.put(`/crm/followups/${id}`, body).then((r) => r.data),
  tasks: (params) => get('/crm/tasks', params),
  createTask: (body) => api.post('/crm/tasks', body).then((r) => r.data),
  updateTask: (id, body) => api.put(`/crm/tasks/${id}`, body).then((r) => r.data),
  interactions: (params) => get('/crm/interactions', params),
  createInteraction: (body) => api.post('/crm/interactions', body).then((r) => r.data),
  updateInteraction: (id, body) => api.put(`/crm/interactions/${id}`, body).then((r) => r.data),
  notes: (params) => get('/crm/notes', params),
  createNote: (body) => api.post('/crm/notes', body).then((r) => r.data),
  updateNote: (id, body) => api.put(`/crm/notes/${id}`, body).then((r) => r.data),
  sampleDispatches: (params) => get('/crm/sample-dispatch', params),
  sampleDispatch: (id) => get(`/crm/sample-dispatch/${id}`),
  sampleDispatchOptions: () => get('/crm/sample-dispatch/options'),
  createSampleDispatch: (body) => api.post('/crm/sample-dispatch', body).then((r) => r.data),
  updateSampleDispatch: (id, body) => api.put(`/crm/sample-dispatch/${id}`, body).then((r) => r.data),
  deleteSampleDispatch: (id) => api.delete(`/crm/sample-dispatch/${id}`).then((r) => r.data),
  markSampleDispatchDelivered: (id) => api.patch(`/crm/sample-dispatch/${id}/delivered`).then((r) => r.data),
  previewSampleDispatchImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/crm/sample-dispatch/import/preview', form).then((r) => r.data);
  },
  commitSampleDispatchImport: (rows) => api.post('/crm/sample-dispatch/import', { rows }).then((r) => r.data),
};

export const salesVisitService = {
  current: () => get('/sales-visits/current'),
  products: (params) => get('/sales-visits/products', params),
  startShift: (body) => api.post('/sales-visits/shifts/start', body).then((r) => r.data),
  recordLocation: (body) => api.post('/sales-visits/shifts/location', body).then((r) => r.data),
  endShift: (body) => api.post('/sales-visits/shifts/end', body).then((r) => r.data),
  checkIn: (body) => api.post('/sales-visits/visits/check-in', body).then((r) => r.data),
  checkOut: (id, location, image) => {
    const form = new FormData();
    form.append('location', JSON.stringify(location));
    form.append('image', image);
    return api.post(`/sales-visits/visits/${id}/check-out`, form).then((r) => r.data);
  },
  history: () => get('/sales-visits/history'),
  team: (params) => get('/sales-visits/team', params),
  photoUrl: (id) => `${import.meta.env.VITE_API_URL || ''}/api/sales-visits/visits/${id}/photo`,
};

export const ordersService = {
  list: (params) => get('/orders', params),
  options: () => get('/orders/options'),
  create: (body) => api.post('/orders', body).then((r) => r.data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
};

export const billingService = {
  list: () => get('/billing'),
  getBusinessSettings: () => get('/billing/settings'),
  saveBusinessSettings: (settings) => api.put('/billing/settings', settings).then((r) => r.data),
  save: (invoice) => api.post('/billing', {
    invoiceId: invoice.id,
    customer: invoice.customer,
    date: invoice.date,
    status: invoice.status,
    subtotal: invoice.subtotal,
    total: invoice.total,
    data: invoice,
  }).then((r) => r.data),
  remove: (invoiceId) => api.delete(`/billing/${encodeURIComponent(invoiceId)}`).then((r) => r.data),
};

export const salesExpensesService = {
  list: (params) => get('/sales-expenses', params),
  create: (body, config) => api.post('/sales-expenses', body, config).then((r) => r.data),
};

export const salesOverviewService = {
  get: (params) => get('/sales-overview', params),
};

export const attendanceService = {
  dashboard: () => get('/attendance/dashboard'),
  my: (params) => get('/attendance/my', params),
  employees: (params) => get('/attendance/employees', params),
  calendar: (params) => get('/attendance/calendar', params),
  reports: (params) => get('/attendance/reports', params),
  exportReports: (params) => api.get('/attendance/reports/export', { params: cleanParams(params), responseType: 'blob' }),
  settings: () => get('/attendance/settings'),
  updateSettings: (body) => api.put('/attendance/settings', body).then((r) => r.data),
  checkIn: (body, file = null) => {
    const payload = file ? buildMultipartForm(body, file) : body;
    return api.post('/attendance/check-in', payload, file ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}).then((r) => r.data);
  },
  checkOut: (body, file = null) => {
    const payload = file ? buildMultipartForm(body, file) : body;
    return api.post('/attendance/check-out', payload, file ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}).then((r) => r.data);
  },
  update: (id, body) => api.put(`/attendance/${id}`, body).then((r) => r.data),
  manual: (body) => api.post('/attendance/manual', body).then((r) => r.data),
};

export const hrService = {
  dashboard: () => get('/hr/dashboard'),
  notifications: () => get('/hr/notifications'),
  markNotificationRead: (id) => api.patch(`/hr/notifications/${id}/read`).then((r) => r.data),
  employees: (params) => get('/hr/employees', params),
  createEmployeeProfile: (body) => api.post('/hr/employees', body).then((r) => r.data),
  updateEmployeeProfile: (id, body) => api.put(`/hr/employees/${id}`, body).then((r) => r.data),
  employee: (id) => get(`/hr/employees/${id}`),
  employeeDocuments: (id) => get(`/hr/employees/${id}/documents`),
  uploadEmployeeDocument: (id, file) => {
    const form = new FormData();
    form.append('document', file);
    return api.post(`/hr/employees/${id}/documents`, form).then((r) => r.data);
  },
  downloadEmployeeDocument: (employeeId, documentId) => api.get(`/hr/employees/${employeeId}/documents/${documentId}`, { responseType: 'blob' }),
  uploadEmployeePhoto: (id, file) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post(`/hr/employees/${id}/photo`, form).then((r) => r.data);
  },
  employeePhoto: (id) => api.get(`/hr/employees/${id}/photo`, { responseType: 'blob' }),
  departments: (params) => get('/hr/departments', params),
  createDepartment: (body) => api.post('/hr/departments', body).then((r) => r.data),
  updateDepartment: (id, body) => api.put(`/hr/departments/${id}`, body).then((r) => r.data),
  leaves: (params) => get('/hr/leaves', params),
  applyLeave: (body) => api.post('/hr/leaves', body).then((r) => r.data),
  createLeaveType: (body) => api.post('/hr/leaves/types', body).then((r) => r.data),
  updateLeaveType: (id, body) => api.put(`/hr/leaves/types/${id}`, body).then((r) => r.data),
  deactivateLeaveType: (id) => api.delete(`/hr/leaves/types/${id}`).then((r) => r.data),
  setLeaveBalance: (body) => api.post('/hr/leaves', { action: 'balance', ...body }).then((r) => r.data),
  reviewLeave: (id, body) => api.put(`/hr/leaves/${id}/review`, body).then((r) => r.data),
  payroll: (params) => get('/hr/payroll', params),
  createPayrollRun: (body) => api.post('/hr/payroll', body).then((r) => r.data),
  approvePayrollRun: (id, body) => api.put(`/hr/payroll/${id}/approve`, body).then((r) => r.data),
  salarySlip: (id) => api.get(`/hr/payroll/${id}/salary-slips`, { responseType: 'blob' }),
  reports: (params) => get('/hr/reports', params),
  exportReports: (params) => api.get('/hr/reports/export', { params: cleanParams(params), responseType: 'blob' }),
  exportReportsPdf: (params) => api.get('/hr/reports/export.pdf', { params: cleanParams(params), responseType: 'blob' }),
};
