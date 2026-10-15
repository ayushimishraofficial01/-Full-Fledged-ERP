const { z, requiredText } = require('./common');

const invoiceRecord = z.object({
  invoiceId: requiredText('Invoice number', 60),
  customer: requiredText('Customer name', 200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid invoice date'),
  status: z.enum(['Paid', 'Unpaid']),
  subtotal: z.coerce.number().finite().min(0).max(1e12),
  total: z.coerce.number().finite().min(0).max(1e12),
  data: z.record(z.string(), z.unknown()),
}).refine((value) => value.data.id === value.invoiceId, 'Invoice number does not match its saved details.');

const businessSettings = z.object({
  company: z.string().max(200), companyGstin: z.string().max(30), companyAddress: z.string().max(2000),
  companyCity: z.string().max(120), companyState: z.string().max(120), companyCountry: z.string().max(120), companyZip: z.string().max(30),
  companyPhone: z.string().max(60), companyEmail: z.string().max(200), companyWebsite: z.string().max(250),
  bank: z.string().max(200), account: z.string().max(100), ifsc: z.string().max(30), branch: z.string().max(250),
  terms: z.string().max(60), supplyState: z.string().max(100), taxMode: z.enum(['Intra-state', 'Inter-state']),
  logo: z.string().max(750000), signatureLogo: z.string().max(750000),
}).partial().strict();

module.exports = { invoiceRecord, businessSettings };
