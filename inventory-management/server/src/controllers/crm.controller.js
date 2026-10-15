const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Customer, Lead, Company, Contact, FollowUp, Task, Interaction, CustomerNote, CRMActivity, StockTransaction } = require('../models');
const { searchRegex, getPagination, paginated } = require('../utils/query');

const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const page = (query) => getPagination(query, { defaultLimit: 25 });
const pick = (body, allowed) => Object.fromEntries(allowed.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
const activity = (req, data) => CRMActivity.create({ ...data, actor: req.user._id });

const customerFields = ['firstName', 'lastName', 'fullName', 'company', 'phone', 'alternatePhone', 'email', 'website', 'address', 'gstNumber', 'panNumber', 'businessType', 'industry', 'customerType', 'status', 'priority', 'leadSource', 'assignedUser', 'tags', 'notes', 'profileImage'];
exports.listCustomers = asyncHandler(async (req, res) => {
  const filter = { status: { $ne: 'archived' } };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.customerType) filter.customerType = req.query.customerType;
  if (req.query.assignedUser && mongoose.isValidObjectId(req.query.assignedUser)) filter.assignedUser = req.query.assignedUser;
  const rx = searchRegex(req.query.search); if (rx) filter.$or = [{ fullName: rx }, { phone: rx }, { alternatePhone: rx }, { email: rx }, { customerId: rx }, { gstNumber: rx }, { panNumber: rx }];
  const pg = page(req.query); const [items, total] = await Promise.all([Customer.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('company', 'name companyId').populate('assignedUser', 'name').lean(), Customer.countDocuments(filter)]);
  res.json({ success: true, ...paginated(items, total, pg) });
});

exports.lookupCustomers = asyncHandler(async (req, res) => {
  const term = String(req.query.search || '').trim().slice(0, 100);
  if (term.length < 2) return res.json({ success: true, items: [] });
  const rx = searchRegex(term);
  const items = await Customer.find({
    status: { $ne: 'archived' },
    $or: [
      { fullName: rx },
      { phone: rx },
      { alternatePhone: rx },
      { email: rx },
      { customerId: rx },
      { gstNumber: rx },
      { panNumber: rx },
      { 'address.line1': rx },
      { 'address.line2': rx },
      { 'address.city': rx },
      { 'address.state': rx },
      { 'address.pincode': rx },
    ],
  })
    .select('customerId fullName phone alternatePhone email website address gstNumber panNumber businessType industry customerType leadSource productCategory requirement expectedValue expectedClosingDate priority')
    .sort({ fullName: 1 })
    .limit(10)
    .lean();
  res.json({ success: true, items });
});

exports.createCustomer = asyncHandler(async (req, res) => {
  const body = pick(req.body, customerFields); if (!body.fullName) body.fullName = [body.firstName, body.lastName].filter(Boolean).join(' ').trim();
  if (!body.fullName) throw ApiError.badRequest('Customer name is required');
  if (body.phone && await Customer.exists({ phone: body.phone, status: { $ne: 'archived' } })) throw ApiError.conflict('A customer with this phone already exists.');
  if (body.email && await Customer.exists({ email: body.email.toLowerCase(), status: { $ne: 'archived' } })) throw ApiError.conflict('A customer with this email already exists.');
  const customer = await Customer.create({ ...body, customerId: id('CUS'), createdBy: req.user._id, updatedBy: req.user._id });
  await activity(req, { action: 'CUSTOMER_CREATED', customer: customer._id, description: `${customer.fullName} was created.` });
  res.status(201).json({ success: true, message: 'Customer created', customer });
});

exports.getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id).populate('company', 'name companyId').populate('assignedUser', 'name email').lean(); if (!customer) throw ApiError.notFound('Customer not found');
  const [purchases, followUps, tasks, interactions, notes, activities] = await Promise.all([
    StockTransaction.find({ customer: customer._id, type: 'STOCK_OUT' }).sort({ date: -1 }).populate('product', 'name sku size unit stockUnit').populate('warehouse', 'name code').lean(),
    FollowUp.find({ customer: customer._id }).sort({ date: -1 }).limit(20).lean(), Task.find({ customer: customer._id }).sort({ dueDate: 1 }).limit(20).lean(), Interaction.find({ customer: customer._id }).sort({ date: -1 }).limit(30).populate('user', 'name').lean(), CustomerNote.find({ customer: customer._id }).sort({ pinned: -1, createdAt: -1 }).lean(), CRMActivity.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(50).populate('actor', 'name').lean(),
  ]);
  const totalQuantity = purchases.reduce((sum, row) => sum + row.quantity, 0);
  res.json({ success: true, customer, summary: { totalPurchases: purchases.length, totalQuantity, lastPurchase: purchases[0]?.date || null }, purchases, followUps, tasks, interactions, notes, activities });
});

exports.updateCustomer = asyncHandler(async (req, res) => { const customer = await Customer.findById(req.params.id); if (!customer) throw ApiError.notFound('Customer not found'); Object.assign(customer, pick(req.body, customerFields), { updatedBy: req.user._id }); if (!customer.fullName) customer.fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim(); await customer.save(); await activity(req, { action: 'CUSTOMER_UPDATED', customer: customer._id, description: `${customer.fullName} was updated.` }); res.json({ success: true, message: 'Customer updated', customer }); });
exports.archiveCustomer = asyncHandler(async (req, res) => { const customer = await Customer.findById(req.params.id); if (!customer) throw ApiError.notFound('Customer not found'); customer.status = 'archived'; customer.archivedAt = new Date(); customer.updatedBy = req.user._id; await customer.save(); await activity(req, { action: 'CUSTOMER_ARCHIVED', customer: customer._id, description: `${customer.fullName} was archived.` }); res.json({ success: true, message: 'Customer archived' }); });
exports.customerPurchases = asyncHandler(async (req, res) => { const items = await StockTransaction.find({ customer: req.params.id, type: 'STOCK_OUT' }).sort({ date: -1 }).populate('product', 'name sku size unit stockUnit').populate('warehouse', 'name code').lean(); res.json({ success: true, items }); });
exports.customerActivities = asyncHandler(async (req, res) => { const items = await CRMActivity.find({ customer: req.params.id }).sort({ createdAt: -1 }).limit(200).populate('actor', 'name').lean(); res.json({ success: true, items }); });

const leadFields = ['name', 'company', 'phone', 'alternatePhone', 'email', 'website', 'address', 'gstNumber', 'panNumber', 'businessType', 'customerType', 'source', 'productCategory', 'industry', 'requirement', 'expectedValue', 'priority', 'status', 'assignedUser', 'expectedClosingDate', 'notes'];
exports.listLeads = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const conditions = [];
  if (req.query.productCategory === '__uncategorized__') conditions.push({ $or: [{ productCategory: { $exists: false } }, { productCategory: '' }, { productCategory: null }] });
  else if (req.query.productCategory) conditions.push({ productCategory: req.query.productCategory });
  const rx = searchRegex(req.query.search);
  if (rx) conditions.push({ $or: [{ name: rx }, { phone: rx }, { alternatePhone: rx }, { email: rx }, { leadId: rx }, { gstNumber: rx }, { panNumber: rx }] });
  if (conditions.length) filter.$and = conditions;
  const pg = page(req.query);
  const [items, total, categories] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('company', 'name').populate('assignedUser', 'name').lean(),
    Lead.countDocuments(filter),
    Lead.distinct('productCategory'),
  ]);
  res.json({ success: true, ...paginated(items, total, pg), categories: categories.filter(Boolean).sort((left, right) => left.localeCompare(right)) });
});
exports.createLead = asyncHandler(async (req, res) => { const lead = await Lead.create({ ...pick(req.body, leadFields), leadId: id('LEAD'), createdBy: req.user._id }); await activity(req, { action: 'LEAD_CREATED', lead: lead._id, description: `${lead.name} was created.` }); res.status(201).json({ success: true, message: 'Lead created', lead }); });
exports.updateLead = asyncHandler(async (req, res) => { const lead = await Lead.findById(req.params.id); if (!lead) throw ApiError.notFound('Lead not found'); const oldStatus = lead.status; Object.assign(lead, pick(req.body, leadFields)); await lead.save(); if (oldStatus !== lead.status) await activity(req, { action: 'LEAD_STATUS_CHANGED', lead: lead._id, description: `${lead.name} changed from ${oldStatus} to ${lead.status}.`, metadata: { oldStatus, newStatus: lead.status } }); res.json({ success: true, message: 'Lead updated', lead }); });
exports.getLead = asyncHandler(async (req, res) => { const lead = await Lead.findById(req.params.id).populate('company', 'name').populate('assignedUser', 'name').lean(); if (!lead) throw ApiError.notFound('Lead not found'); res.json({ success: true, lead }); });
exports.convertLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');

  let customer = lead.convertedCustomer ? await Customer.findById(lead.convertedCustomer) : null;
  if (!customer) {
    const identityMatches = [];
    if (lead.email) identityMatches.push({ email: lead.email.toLowerCase() });
    if (lead.phone) identityMatches.push({ phone: lead.phone });
    if (identityMatches.length) {
      customer = await Customer.findOne({ $or: identityMatches, status: { $ne: 'archived' } });
    }
  }

  const wasAlreadyConverted = Boolean(lead.convertedCustomer);
  const previousLeadStage = wasAlreadyConverted && lead.status === 'Converted'
    ? (customer?.leadStage || 'New')
    : lead.status;

  if (!customer) {
    const [firstName = '', ...lastNameParts] = lead.name.trim().split(/\s+/);
    customer = new Customer({
      customerId: id('CUS'),
      firstName,
      lastName: lastNameParts.join(' '),
      fullName: lead.name,
      phone: lead.phone || '',
      alternatePhone: lead.alternatePhone || '',
      email: lead.email || '',
      website: lead.website || '',
      company: lead.company,
      address: lead.address?.toObject ? lead.address.toObject() : lead.address,
      gstNumber: lead.gstNumber || '',
      panNumber: lead.panNumber || '',
      businessType: lead.businessType,
      customerType: lead.customerType || 'B2C',
      leadSource: lead.source,
      industry: lead.industry,
      priority: lead.priority,
      productCategory: lead.productCategory,
      requirement: lead.requirement,
      expectedValue: lead.expectedValue,
      expectedClosingDate: lead.expectedClosingDate,
      leadStage: previousLeadStage,
      leadId: lead.leadId,
      originatingLead: lead._id,
      assignedUser: lead.assignedUser,
      notes: lead.notes || '',
      createdBy: lead.createdBy || req.user._id,
      updatedBy: req.user._id,
    });
  } else {
    const [firstName = '', ...lastNameParts] = lead.name.trim().split(/\s+/);
    customer.firstName = firstName;
    customer.lastName = lastNameParts.join(' ');
    customer.fullName = lead.name;
    if (lead.phone) customer.phone = lead.phone;
    if (lead.alternatePhone) customer.alternatePhone = lead.alternatePhone;
    if (lead.email) customer.email = lead.email;
    if (lead.website) customer.website = lead.website;
    if (lead.company) customer.company = lead.company;
    if (lead.address) customer.address = lead.address.toObject ? lead.address.toObject() : lead.address;
    if (lead.gstNumber) customer.gstNumber = lead.gstNumber;
    if (lead.panNumber) customer.panNumber = lead.panNumber;
    if (lead.businessType) customer.businessType = lead.businessType;
    if (lead.customerType) customer.customerType = lead.customerType;
    if (lead.source) customer.leadSource = lead.source;
    if (lead.industry) customer.industry = lead.industry;
    if (lead.priority) customer.priority = lead.priority;
    if (lead.assignedUser) customer.assignedUser = lead.assignedUser;
    if (lead.notes && !customer.notes?.includes(lead.notes)) {
      customer.notes = [customer.notes, lead.notes].filter(Boolean).join('\n\n');
    }
    customer.productCategory = lead.productCategory || '';
    customer.requirement = lead.requirement || '';
    customer.expectedValue = lead.expectedValue || 0;
    customer.expectedClosingDate = lead.expectedClosingDate;
    customer.leadStage = wasAlreadyConverted ? (customer.leadStage || 'New') : lead.status;
    customer.leadId = lead.leadId;
    customer.originatingLead = lead._id;
    customer.updatedBy = req.user._id;
  }

  await customer.save();
  lead.status = 'Converted';
  lead.convertedCustomer = customer._id;
  await lead.save();
  if (!wasAlreadyConverted) {
    await activity(req, { action: 'LEAD_CONVERTED', lead: lead._id, customer: customer._id, description: `${lead.name} was converted to a customer.` });
  }
  res.json({ success: true, message: wasAlreadyConverted ? 'Customer record updated from the lead' : 'Lead converted', customer, lead });
});

const companyFields = ['companyId', 'name', 'industry', 'gstNumber', 'pan', 'website', 'phone', 'email', 'address', 'city', 'state', 'pincode', 'assignedUser', 'status', 'notes'];
exports.listCompanies = asyncHandler(async (req, res) => { const filter = {}; if (req.query.status) filter.status = req.query.status; const rx = searchRegex(req.query.search); if (rx) filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { companyId: rx }]; const pg = page(req.query); const [items, total] = await Promise.all([Company.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('assignedUser', 'name').lean(), Company.countDocuments(filter)]); res.json({ success: true, ...paginated(items, total, pg) }); });
exports.createCompany = asyncHandler(async (req, res) => { const company = await Company.create({ ...pick(req.body, companyFields), companyId: id('COM'), createdBy: req.user._id }); res.status(201).json({ success: true, message: 'Company created', company }); });
exports.getCompany = asyncHandler(async (req, res) => { const company = await Company.findById(req.params.id).populate('assignedUser', 'name').lean(); if (!company) throw ApiError.notFound('Company not found'); res.json({ success: true, company }); });
exports.updateCompany = asyncHandler(async (req, res) => { const company = await Company.findById(req.params.id); if (!company) throw ApiError.notFound('Company not found'); Object.assign(company, pick(req.body, companyFields)); await company.save(); res.json({ success: true, message: 'Company updated', company }); });
exports.deleteCompany = asyncHandler(async (req, res) => { const company = await Company.findById(req.params.id); if (!company) throw ApiError.notFound('Company not found'); await company.deleteOne(); res.json({ success: true, message: 'Company deleted' }); });

const contactFields = ['firstName', 'lastName', 'designation', 'company', 'customer', 'phone', 'alternatePhone', 'email', 'department', 'contactType', 'assignedUser', 'notes'];
exports.listContacts = asyncHandler(async (req, res) => { const filter = {}; const rx = searchRegex(req.query.search); if (rx) filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }]; const pg = page(req.query); const [items, total] = await Promise.all([Contact.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('company', 'name').populate('customer', 'fullName').populate('assignedUser', 'name').lean(), Contact.countDocuments(filter)]); res.json({ success: true, ...paginated(items, total, pg) }); });
exports.createContact = asyncHandler(async (req, res) => { const contact = await Contact.create({ ...pick(req.body, contactFields), contactId: id('CON'), createdBy: req.user._id }); res.status(201).json({ success: true, message: 'Contact created', contact }); });
exports.updateContact = asyncHandler(async (req, res) => { const contact = await Contact.findById(req.params.id); if (!contact) throw ApiError.notFound('Contact not found'); Object.assign(contact, pick(req.body, contactFields)); await contact.save(); res.json({ success: true, message: 'Contact updated', contact }); });
exports.deleteContact = asyncHandler(async (req, res) => { const contact = await Contact.findById(req.params.id); if (!contact) throw ApiError.notFound('Contact not found'); await contact.deleteOne(); res.json({ success: true, message: 'Contact deleted' }); });

const followUpFields = ['customer', 'lead', 'date', 'type', 'subject', 'description', 'assignedUser', 'priority', 'status', 'reminder', 'completedDate'];
exports.listFollowUps = asyncHandler(async (req, res) => { const filter = {}; if (req.query.status) filter.status = req.query.status; const pg = page(req.query); const [items, total] = await Promise.all([FollowUp.find(filter).sort({ date: -1 }).skip(pg.skip).limit(pg.limit).populate('customer', 'fullName').populate('lead', 'name').populate('assignedUser', 'name').lean(), FollowUp.countDocuments(filter)]); res.json({ success: true, ...paginated(items, total, pg) }); });
exports.createFollowUp = asyncHandler(async (req, res) => { const followUp = await FollowUp.create({ ...pick(req.body, followUpFields), followUpId: id('FUP'), createdBy: req.user._id }); res.status(201).json({ success: true, message: 'Follow-up created', followUp }); });
exports.updateFollowUp = asyncHandler(async (req, res) => { const followUp = await FollowUp.findById(req.params.id); if (!followUp) throw ApiError.notFound('Follow-up not found'); Object.assign(followUp, pick(req.body, followUpFields)); await followUp.save(); res.json({ success: true, message: 'Follow-up updated', followUp }); });
exports.deleteFollowUp = asyncHandler(async (req, res) => { const followUp = await FollowUp.findById(req.params.id); if (!followUp) throw ApiError.notFound('Follow-up not found'); await followUp.deleteOne(); res.json({ success: true, message: 'Follow-up deleted' }); });

const taskFields = ['title', 'description', 'customer', 'lead', 'assignedUser', 'priority', 'dueDate', 'status', 'completedDate'];
exports.listTasks = asyncHandler(async (req, res) => { const filter = {}; if (req.query.status) filter.status = req.query.status; const pg = page(req.query); const [items, total] = await Promise.all([Task.find(filter).sort({ dueDate: 1 }).skip(pg.skip).limit(pg.limit).populate('customer', 'fullName').populate('lead', 'name').populate('assignedUser', 'name').lean(), Task.countDocuments(filter)]); res.json({ success: true, ...paginated(items, total, pg) }); });
exports.createTask = asyncHandler(async (req, res) => { const task = await Task.create({ ...pick(req.body, taskFields), taskId: id('TASK'), createdBy: req.user._id }); res.status(201).json({ success: true, message: 'Task created', task }); });
exports.updateTask = asyncHandler(async (req, res) => { const task = await Task.findById(req.params.id); if (!task) throw ApiError.notFound('Task not found'); Object.assign(task, pick(req.body, taskFields)); await task.save(); res.json({ success: true, message: 'Task updated', task }); });
exports.deleteTask = asyncHandler(async (req, res) => { const task = await Task.findById(req.params.id); if (!task) throw ApiError.notFound('Task not found'); await task.deleteOne(); res.json({ success: true, message: 'Task deleted' }); });

const interactionFields = ['customer', 'lead', 'type', 'subject', 'description', 'outcome', 'nextFollowUp', 'date'];
exports.listInteractions = asyncHandler(async (req, res) => { const filter = {}; if (req.query.customer) filter.customer = req.query.customer; if (req.query.lead) filter.lead = req.query.lead; const pg = page(req.query); const [items, total] = await Promise.all([Interaction.find(filter).sort({ date: -1 }).skip(pg.skip).limit(pg.limit).populate('customer', 'fullName').populate('lead', 'name').populate('user', 'name').lean(), Interaction.countDocuments(filter)]); res.json({ success: true, ...paginated(items, total, pg) }); });
exports.createInteraction = asyncHandler(async (req, res) => { const interaction = await Interaction.create({ ...pick(req.body, interactionFields), interactionId: id('INT'), user: req.user._id }); res.status(201).json({ success: true, message: 'Interaction created', interaction }); });
exports.updateInteraction = asyncHandler(async (req, res) => { const interaction = await Interaction.findById(req.params.id); if (!interaction) throw ApiError.notFound('Interaction not found'); Object.assign(interaction, pick(req.body, interactionFields)); await interaction.save(); res.json({ success: true, message: 'Interaction updated', interaction }); });
exports.deleteInteraction = asyncHandler(async (req, res) => { const interaction = await Interaction.findById(req.params.id); if (!interaction) throw ApiError.notFound('Interaction not found'); await interaction.deleteOne(); res.json({ success: true, message: 'Interaction deleted' }); });

const noteFields = ['title', 'description', 'customer', 'lead', 'company', 'contact', 'pinned'];
exports.listNotes = asyncHandler(async (req, res) => { const filter = {}; if (req.query.customer) filter.customer = req.query.customer; if (req.query.lead) filter.lead = req.query.lead; const pg = page(req.query); const [items, total] = await Promise.all([CustomerNote.find(filter).sort({ pinned: -1, createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('createdBy', 'name').lean(), CustomerNote.countDocuments(filter)]); res.json({ success: true, ...paginated(items, total, pg) }); });
exports.createNote = asyncHandler(async (req, res) => { const note = await CustomerNote.create({ ...pick(req.body, noteFields), createdBy: req.user._id }); res.status(201).json({ success: true, message: 'Note created', note }); });
exports.updateNote = asyncHandler(async (req, res) => { const note = await CustomerNote.findById(req.params.id); if (!note) throw ApiError.notFound('Note not found'); Object.assign(note, pick(req.body, noteFields)); await note.save(); res.json({ success: true, message: 'Note updated', note }); });
exports.deleteNote = asyncHandler(async (req, res) => { const note = await CustomerNote.findById(req.params.id); if (!note) throw ApiError.notFound('Note not found'); await note.deleteOne(); res.json({ success: true, message: 'Note deleted' }); });

const models = { companies: Company, contacts: Contact, followups: FollowUp, tasks: Task, interactions: Interaction, notes: CustomerNote };
const fieldMap = { companies: ['name', 'industry', 'gstNumber', 'pan', 'website', 'phone', 'email', 'address', 'city', 'state', 'pincode', 'assignedUser', 'status', 'notes'], contacts: ['firstName', 'lastName', 'designation', 'company', 'customer', 'phone', 'alternatePhone', 'email', 'department', 'contactType', 'assignedUser', 'notes'], followups: ['customer', 'lead', 'date', 'type', 'subject', 'description', 'assignedUser', 'priority', 'status', 'reminder', 'completedDate'], tasks: ['title', 'description', 'customer', 'lead', 'assignedUser', 'priority', 'dueDate', 'status', 'completedDate'], interactions: ['customer', 'lead', 'type', 'subject', 'description', 'outcome', 'nextFollowUp', 'date'], notes: ['title', 'description', 'customer', 'lead', 'company', 'contact', 'pinned'] };
const prefixes = { companies: 'COM', contacts: 'CON', followups: 'FUP', tasks: 'TASK', interactions: 'INT' };
exports.genericList = asyncHandler(async (req, res) => { const key = req.params.entity; const Model = models[key]; if (!Model) throw ApiError.notFound('CRM entity not found'); const pg = page(req.query); const [items, total] = await Promise.all([Model.find(req.query.customer ? { customer: req.query.customer } : {}).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('assignedUser', 'name').populate('customer', 'fullName customerId').populate('lead', 'name leadId').lean(), Model.countDocuments(req.query.customer ? { customer: req.query.customer } : {})]); res.json({ success: true, ...paginated(items, total, pg) }); });
exports.genericCreate = asyncHandler(async (req, res) => { const key = req.params.entity; const Model = models[key]; if (!Model) throw ApiError.notFound('CRM entity not found'); const body = pick(req.body, fieldMap[key]); if (prefixes[key]) body[`${key === 'companies' ? 'companyId' : key.slice(0, -1) + 'Id'}`] = id(prefixes[key]); if (key === 'notes') body.createdBy = req.user._id; else if (key === 'interactions') body.user = req.user._id; else body.createdBy = req.user._id; const item = await Model.create(body); await activity(req, { action: `CRM_${key.toUpperCase()}_CREATED`, customer: body.customer, lead: body.lead, description: `A ${key.slice(0, -1)} was created.` }); res.status(201).json({ success: true, message: 'CRM record created', item }); });
exports.genericUpdate = asyncHandler(async (req, res) => { const key = req.params.entity; const Model = models[key]; if (!Model) throw ApiError.notFound('CRM entity not found'); const item = await Model.findByIdAndUpdate(req.params.id, pick(req.body, fieldMap[key]), { new: true, runValidators: true }); if (!item) throw ApiError.notFound('CRM record not found'); res.json({ success: true, message: 'CRM record updated', item }); });
exports.genericDelete = asyncHandler(async (req, res) => { const key = req.params.entity; const Model = models[key]; if (!Model) throw ApiError.notFound('CRM entity not found'); const item = await Model.findByIdAndDelete(req.params.id); if (!item) throw ApiError.notFound('CRM record not found'); res.json({ success: true, message: 'CRM record deleted' }); });

exports.dashboard = asyncHandler(async (req, res) => { const [totalCustomers, newCustomers, activeCustomers, totalLeads, newLeads, convertedLeads, pendingFollowUps, todayFollowUps, overdueFollowUps, openTasks, completedTasks] = await Promise.all([Customer.countDocuments({ status: { $ne: 'archived' } }), Customer.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }), Customer.countDocuments({ status: 'active' }), Lead.countDocuments(), Lead.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }), Lead.countDocuments({ status: 'Converted' }), FollowUp.countDocuments({ status: 'Pending' }), FollowUp.countDocuments({ date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lt: new Date(new Date().setHours(24, 0, 0, 0)) }, status: { $nin: ['Completed', 'Cancelled'] } }), FollowUp.countDocuments({ date: { $lt: new Date() }, status: 'Pending' }), Task.countDocuments({ status: { $in: ['Pending', 'In Progress'] } }), Task.countDocuments({ status: 'Completed' })]); res.json({ success: true, dashboard: { totalCustomers, newCustomers, activeCustomers, inactiveCustomers: await Customer.countDocuments({ status: 'inactive' }), totalLeads, newLeads, convertedLeads, pendingFollowUps, todayFollowUps, overdueFollowUps, openTasks, completedTasks } }); });

exports.reports = asyncHandler(async (req, res) => {
  const [customers, leads, followUps, tasks] = await Promise.all([
    Customer.aggregate([
      { $match: { status: { $ne: 'archived' } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
        },
      },
    ]),
    Lead.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } },
          open: { $sum: { $cond: [{ $ne: ['$status', 'Converted'] }, 1, 0] } },
        },
      },
    ]),
    FollowUp.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  res.json({
    success: true,
    reports: {
      customers: customers[0] || { total: 0, active: 0, inactive: 0 },
      leads: leads[0] || { total: 0, converted: 0, open: 0 },
      followUps: followUps.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {}),
      tasks: tasks.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {}),
    },
  });
});

exports.activityTimeline = asyncHandler(async (req, res) => {
  const items = await CRMActivity.find({}).sort({ createdAt: -1 }).limit(100).populate('actor', 'name').populate('customer', 'fullName').populate('lead', 'name').lean();
  res.json({ success: true, items });
});
