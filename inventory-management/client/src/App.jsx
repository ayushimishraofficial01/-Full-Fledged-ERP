import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, GuestRoute, PermissionGuard } from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import { PageLoader } from './components/ui';

import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductionDashboard = lazy(() => import('./pages/production/ProductionDashboard'));
const AddProduction = lazy(() => import('./pages/production/AddProduction'));
const ProductionStock = lazy(() => import('./pages/production/ProductionStock'));
const TransferProduction = lazy(() => import('./pages/production/TransferProduction'));
const ProductionHistory = lazy(() => import('./pages/production/ProductionHistory'));
const ProductList = lazy(() => import('./pages/products/ProductList'));
const ProductForm = lazy(() => import('./pages/products/ProductForm'));
const ProductDetail = lazy(() => import('./pages/products/ProductDetail'));
const ProductImport = lazy(() => import('./pages/products/ProductImport'));
const WarehouseList = lazy(() => import('./pages/warehouses/WarehouseList'));
const WarehouseForm = lazy(() => import('./pages/warehouses/WarehouseForm'));
const CurrentStock = lazy(() => import('./pages/inventory/CurrentStock'));
const WarehouseStock = lazy(() => import('./pages/inventory/WarehouseStock'));
const LowStock = lazy(() => import('./pages/inventory/LowStock'));
const StockIn = lazy(() => import('./pages/stock/StockIn'));
const StockOut = lazy(() => import('./pages/stock/StockOut'));
const StockTransfer = lazy(() => import('./pages/stock/StockTransfer'));
const TransactionHistory = lazy(() => import('./pages/stock/TransactionHistory'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const ExcelCenter = lazy(() => import('./pages/ExcelCenter'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const AccessManagement = lazy(() => import('./pages/AccessManagement'));
const AccessDenied = lazy(() => import('./pages/AccessDenied'));
const CRMDashboard = lazy(() => import('./pages/crm/CRMDashboard'));
const Customers = lazy(() => import('./pages/crm/Customers'));
const CustomerProfile = lazy(() => import('./pages/crm/CustomerProfile'));
const SampleDispatches = lazy(() => import('./pages/crm/SampleDispatches'));
const SampleDispatchImport = lazy(() => import('./pages/crm/SampleDispatchImport'));
const Leads = lazy(() => import('./pages/crm/Leads'));
const Companies = lazy(() => import('./pages/crm/Companies'));
const Contacts = lazy(() => import('./pages/crm/Contacts'));
const FollowUps = lazy(() => import('./pages/crm/FollowUps'));
const Tasks = lazy(() => import('./pages/crm/Tasks'));
const Interactions = lazy(() => import('./pages/crm/Interactions'));
const Notes = lazy(() => import('./pages/crm/Notes'));
const CRMReports = lazy(() => import('./pages/crm/CRMReports'));
const ActivityTimeline = lazy(() => import('./pages/crm/ActivityTimeline'));
const SalesVisits = lazy(() => import('./pages/sales/SalesVisits'));
const SalesTeamVisits = lazy(() => import('./pages/sales/SalesTeamVisits'));
const Orders = lazy(() => import('./pages/sales/Orders'));
const Billing = lazy(() => import('./pages/Billing'));
const SalesExpenses = lazy(() => import('./pages/sales/SalesExpenses'));
const SalesOverview = lazy(() => import('./pages/sales/SalesOverview'));
const AttendanceModule = lazy(() => import('./pages/attendance/AttendanceModule'));
const HRModule = lazy(() => import('./pages/hr/HRModule'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<GuestRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>
        </Route>
        <Route element={<AuthLayout />}>
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/production" element={<ProductionDashboard />} />
            <Route path="/production/new" element={<AddProduction />} />
            <Route path="/production/stock" element={<ProductionStock />} />
            <Route path="/production/transfer" element={<TransferProduction />} />
            <Route path="/production/history" element={<ProductionHistory />} />

            <Route path="/products" element={<ProductList />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/import" element={<ProductImport />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/products/:id/edit" element={<ProductForm />} />

            <Route path="/warehouses" element={<WarehouseList />} />
            <Route path="/warehouses/new" element={<WarehouseForm />} />
            <Route path="/warehouses/:id/edit" element={<WarehouseForm />} />

            <Route path="/inventory" element={<CurrentStock />} />
            <Route path="/inventory/warehouse" element={<WarehouseStock />} />
            <Route path="/inventory/warehouse/:warehouseId" element={<WarehouseStock />} />
            <Route path="/inventory/low-stock" element={<LowStock />} />

            <Route path="/stock/in" element={<StockIn />} />
            <Route path="/stock/out" element={<StockOut />} />
            <Route path="/stock/transfer" element={<StockTransfer />} />
            <Route path="/stock/history" element={<TransactionHistory />} />

            <Route path="/reports" element={<Navigate to="/reports/stock-in" replace />} />
            <Route path="/reports/production" element={<ProductionHistory />} />
            <Route path="/reports/:type" element={<Reports />} />

            <Route path="/excel" element={<ExcelCenter />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/crm" element={<PermissionGuard permission="crm.view"><CRMDashboard /></PermissionGuard>} />
            <Route path="/crm/dashboard" element={<PermissionGuard permission="crm.dashboard.view"><CRMDashboard /></PermissionGuard>} />
            <Route path="/crm/customers" element={<PermissionGuard permission="customers.view"><Customers /></PermissionGuard>} />
            <Route path="/crm/customers/:id" element={<PermissionGuard permission="customers.view"><CustomerProfile /></PermissionGuard>} />
            <Route path="/crm/sample-dispatch" element={<PermissionGuard permission="sample_dispatch.view"><SampleDispatches /></PermissionGuard>} />
            <Route path="/crm/sample-dispatch/import" element={<PermissionGuard permission="sample_dispatch.create"><SampleDispatchImport /></PermissionGuard>} />
            <Route path="/crm/leads" element={<PermissionGuard permission="leads.view"><Leads /></PermissionGuard>} />
            <Route path="/crm/companies" element={<PermissionGuard permission="companies.view"><Companies /></PermissionGuard>} />
            <Route path="/crm/contacts" element={<PermissionGuard permission="contacts.view"><Contacts /></PermissionGuard>} />
            <Route path="/crm/followups" element={<PermissionGuard permission="followups.view"><FollowUps /></PermissionGuard>} />
            <Route path="/crm/tasks" element={<PermissionGuard permission="tasks.view"><Tasks /></PermissionGuard>} />
            <Route path="/crm/interactions" element={<PermissionGuard permission="interactions.view"><Interactions /></PermissionGuard>} />
            <Route path="/crm/notes" element={<PermissionGuard permission="notes.view"><Notes /></PermissionGuard>} />
            <Route path="/crm/reports" element={<PermissionGuard permission="crm.reports.view"><CRMReports /></PermissionGuard>} />
            <Route path="/crm/activity" element={<PermissionGuard permission="crm.view"><ActivityTimeline /></PermissionGuard>} />
            <Route path="/sales-visits" element={<PermissionGuard permission="sales_visits.track"><SalesVisits /></PermissionGuard>} />
            <Route path="/sales-visits/team" element={<PermissionGuard permission="sales_visits.view"><SalesTeamVisits /></PermissionGuard>} />
            <Route path="/sales/expenses" element={<PermissionGuard permission="sales_expenses.view"><SalesExpenses /></PermissionGuard>} />
            <Route path="/sales/overview" element={<PermissionGuard permission="sales_overview.view"><SalesOverview /></PermissionGuard>} />
            <Route path="/orders" element={<PermissionGuard permission="orders.view"><Orders /></PermissionGuard>} />
            <Route path="/billing" element={<PermissionGuard permission="orders.view"><Billing /></PermissionGuard>} />
            <Route path="/attendance" element={<AttendanceModule />} />
            <Route path="/attendance/my" element={<AttendanceModule />} />
            <Route path="/attendance/employees" element={<AttendanceModule />} />
            <Route path="/attendance/calendar" element={<AttendanceModule />} />
            <Route path="/attendance/reports" element={<AttendanceModule />} />
            <Route path="/attendance/settings" element={<AttendanceModule />} />
            <Route path="/hr/*" element={<PermissionGuard permission="hr.dashboard.view"><HRModule /></PermissionGuard>} />
            <Route path="/settings/access" element={<PermissionGuard permission="users.view"><AccessManagement /></PermissionGuard>} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
