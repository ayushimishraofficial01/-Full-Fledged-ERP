const router = require('express').Router();
const c = require('../controllers/crm.controller');
const sampleDispatch = require('../controllers/sampleDispatch.controller');
const { requirePermission } = require('../middleware/authorization');
const { excelFile } = require('../middleware/upload');

router.get('/dashboard', requirePermission('crm.dashboard.view'), c.dashboard);

router.get('/customers', requirePermission('customers.view'), c.listCustomers);
router.get('/customer-lookup', requirePermission('customers.lookup', 'customers.view'), c.lookupCustomers);
router.post('/customers', requirePermission('customers.create'), c.createCustomer);
router.get('/customers/:id', requirePermission('customers.view'), c.getCustomer);
router.put('/customers/:id', requirePermission('customers.edit'), c.updateCustomer);
router.patch('/customers/:id/archive', requirePermission('customers.archive'), c.archiveCustomer);
router.get('/customers/:id/purchases', requirePermission('customers.view'), c.customerPurchases);
router.get('/customers/:id/activity', requirePermission('customers.view'), c.customerActivities);
router.get('/customers/:id/sample-dispatches', requirePermission('sample_dispatch.view'), sampleDispatch.customerHistory);

router.get('/sample-dispatch/export', requirePermission('sample_dispatch.export'), sampleDispatch.export);
router.get('/sample-dispatch/import/template', requirePermission('sample_dispatch.create'), sampleDispatch.template);
router.post('/sample-dispatch/import/preview', requirePermission('sample_dispatch.create'), excelFile, sampleDispatch.importPreview);
router.post('/sample-dispatch/import', requirePermission('sample_dispatch.create'), sampleDispatch.importCommit);
router.get('/sample-dispatch/options', requirePermission('sample_dispatch.create', 'sample_dispatch.edit'), sampleDispatch.options);
router.get('/sample-dispatch', requirePermission('sample_dispatch.view'), sampleDispatch.list);
router.post('/sample-dispatch', requirePermission('sample_dispatch.create'), sampleDispatch.create);
router.get('/sample-dispatch/:id', requirePermission('sample_dispatch.view'), sampleDispatch.get);
router.put('/sample-dispatch/:id', requirePermission('sample_dispatch.edit'), sampleDispatch.update);
router.patch('/sample-dispatch/:id/delivered', requirePermission('sample_dispatch.edit'), sampleDispatch.markDelivered);
router.delete('/sample-dispatch/:id', requirePermission('sample_dispatch.delete'), sampleDispatch.remove);

router.get('/leads', requirePermission('leads.view'), c.listLeads);
router.post('/leads', requirePermission('leads.create'), c.createLead);
router.get('/leads/:id', requirePermission('leads.view'), c.getLead);
router.put('/leads/:id', requirePermission('leads.edit'), c.updateLead);
router.post('/leads/:id/convert', requirePermission('leads.convert'), c.convertLead);

router.get('/companies', requirePermission('companies.view'), c.listCompanies);
router.post('/companies', requirePermission('companies.create'), c.createCompany);
router.get('/companies/:id', requirePermission('companies.view'), c.getCompany);
router.put('/companies/:id', requirePermission('companies.edit'), c.updateCompany);
router.delete('/companies/:id', requirePermission('companies.delete'), c.deleteCompany);

router.get('/contacts', requirePermission('contacts.view'), c.listContacts);
router.post('/contacts', requirePermission('contacts.create'), c.createContact);
router.put('/contacts/:id', requirePermission('contacts.edit'), c.updateContact);
router.delete('/contacts/:id', requirePermission('contacts.delete'), c.deleteContact);

router.get('/followups', requirePermission('followups.view'), c.listFollowUps);
router.post('/followups', requirePermission('followups.create'), c.createFollowUp);
router.put('/followups/:id', requirePermission('followups.edit'), c.updateFollowUp);
router.delete('/followups/:id', requirePermission('followups.delete'), c.deleteFollowUp);

router.get('/tasks', requirePermission('tasks.view'), c.listTasks);
router.post('/tasks', requirePermission('tasks.create'), c.createTask);
router.put('/tasks/:id', requirePermission('tasks.edit'), c.updateTask);
router.delete('/tasks/:id', requirePermission('tasks.delete'), c.deleteTask);

router.get('/interactions', requirePermission('interactions.view'), c.listInteractions);
router.post('/interactions', requirePermission('interactions.create'), c.createInteraction);
router.put('/interactions/:id', requirePermission('interactions.edit'), c.updateInteraction);
router.delete('/interactions/:id', requirePermission('interactions.delete'), c.deleteInteraction);

router.get('/notes', requirePermission('notes.view'), c.listNotes);
router.post('/notes', requirePermission('notes.create'), c.createNote);
router.put('/notes/:id', requirePermission('notes.edit'), c.updateNote);
router.delete('/notes/:id', requirePermission('notes.delete'), c.deleteNote);

module.exports = router;
