import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Download, FileText, Plus, Printer, Search, Settings2, Trash2, Upload, X } from 'lucide-react';
import { Button, Card, PageHeader } from '../components/ui';
import CustomerLookup from '../components/CustomerLookup';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { billingService } from '../services';
import { calculateInvoiceTotals, invoiceLineAmount, validateInvoice } from '../utils/billing';
import { downloadInvoicePdf, openInvoicePdfPreview } from '../utils/invoicePdf';

const STORAGE_KEY = 'stockpilot.billing.invoices.v1';
const SETTINGS_KEY = 'stockpilot.billing.business-settings.v1';
const sampleLogo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="43" fill="none" stroke="#92bd3e" stroke-width="6" stroke-dasharray="190 90" transform="rotate(-42 50 50)"/><circle cx="50" cy="50" r="43" fill="none" stroke="#329cc5" stroke-width="6" stroke-dasharray="92 190" transform="rotate(28 50 50)"/><path d="M19 48c14-26 29-18 34-8 11-16 28-12 32 2-9-7-18-5-26 7-11 17-25 17-40-1Z" fill="#72b448"/><circle cx="36" cy="44" r="7" fill="#fff" stroke="#438c5b" stroke-width="3"/><circle cx="65" cy="42" r="7" fill="#fff" stroke="#438c5b" stroke-width="3"/><path d="M33 65c9 7 24 8 35 0" fill="none" stroke="#3692aa" stroke-width="3" stroke-linecap="round"/><text x="50" y="80" text-anchor="middle" font-size="13" font-family="Arial" fill="#438e9e">ecoloop</text></svg>')}`;
const sampleSeal = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="94" fill="#fffdf8" stroke="#a87325" stroke-width="3"/><circle cx="100" cy="100" r="84" fill="none" stroke="#a87325" stroke-width="2"/><circle cx="100" cy="100" r="62" fill="none" stroke="#a87325" stroke-width="2"/><text x="100" y="42" text-anchor="middle" fill="#8e5e20" font-size="12" font-family="Georgia" font-weight="bold" letter-spacing="2">BHARAT KITCHEN</text><text x="100" y="167" text-anchor="middle" fill="#8e5e20" font-size="10" font-family="Georgia" font-weight="bold" letter-spacing="2">PRIVATE LIMITED</text><path d="M65 112c-9-17 8-29 20-19l14 12 14-12c12-10 29 2 20 19l-17 26H82z" fill="none" stroke="#a87325" stroke-width="2"/><text x="100" y="111" text-anchor="middle" fill="#8e5e20" font-size="29" font-family="Georgia" font-weight="bold">BK</text><text x="100" y="132" text-anchor="middle" fill="#8e5e20" font-size="7" font-family="Georgia" letter-spacing="1">BHARAT KITCHEN</text></svg>')}`;
const emptySettings = { company: 'BHARAT KITCHEN PRIVATE LIMITED', companyGstin: '09AAOCB4151G1ZL', companyAddress: 'Uttar Pradesh\nIndia', companyCity: '', companyState: '', companyCountry: 'India', companyZip: '', companyPhone: '91-9451868863', companyEmail: 'Ecoloop001@gmail.com', companyWebsite: 'www.ecoloop.org.in', bank: 'AU small finance Bank', account: '333333333344445', ifsc: 'AUBL0002692', branch: 'M Block, Kidwai Nagar, Kanpur Nagar', logo: sampleLogo, signatureLogo: sampleSeal, terms: 'Due on Receipt', supplyState: 'West Bengal (19)', taxMode: 'Inter-state' };
const normalizeSettings = (settings = {}) => ({ ...emptySettings, ...settings, supplyState: String(settings.supplyState || '').trim() || emptySettings.supplyState });
const readSettings = () => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(emptySettings)); return emptySettings; }
    return normalizeSettings(JSON.parse(saved));
  } catch { return emptySettings; }
};
const today = () => new Date().toISOString().slice(0, 10);
const newLine = () => ({ description: '', hsn: '', qty: '1', unit: 'pcs', rate: '', gst: '5' });
const freshInvoice = (settings = emptySettings) => ({
  id: `INV-${new Date().getFullYear().toString().slice(-2)}-${String(Date.now()).slice(-6)}`,
  date: today(), dueDate: today(), terms: settings.terms || 'Due on Receipt', supplyState: settings.supplyState || '', taxMode: settings.taxMode || 'Intra-state',
  customer: '', customerPhone: '', customerEmail: '', customerAddress: '', customerCity: '', customerState: '', customerCountry: '', customerZip: '', customerGstin: '', shipTo: '', shipToCity: '', shipToState: '', shipToCountry: '', shipToZip: '',
  company: settings.company || '', companyAddress: settings.companyAddress || '', companyCity: settings.companyCity || '', companyState: settings.companyState || '', companyCountry: settings.companyCountry || '', companyZip: settings.companyZip || '', companyGstin: settings.companyGstin || '', companyPhone: settings.companyPhone || '', companyEmail: settings.companyEmail || '', companyWebsite: settings.companyWebsite || '', logo: settings.logo || '', signatureLogo: settings.signatureLogo || '',
  bank: settings.bank || '', account: settings.account || '', ifsc: settings.ifsc || '', branch: settings.branch || '', notes: 'Thanks for your business.', credits: '0', lines: [newLine()], status: 'Unpaid',
});
const readInvoices = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
const dateLabel = (date) => date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN') : '—';
const words = (value) => {
  const n = Math.floor(Number(value) || 0);
  if (!n) return 'Zero';
  const small = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const chunk = (x) => x < 20 ? small[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${small[x % 10]}` : ''}`;
  const part = (x, divisor, label) => { const q = Math.floor(x / divisor); return [q ? `${chunk(q)} ${label}` : '', x % divisor]; };
  let x = n; const out = [];
  for (const [divisor, label] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [100, 'Hundred']]) { const [text, rest] = part(x, divisor, label); if (text) out.push(text); x = rest; }
  if (x) out.push(chunk(x));
  return out.join(' ');
};
const formatAddress = (address, city, state, country, zip) => {
  const lines = String(address || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cityStateZip = [city, state, zip].filter(Boolean).join(', ');
  if (cityStateZip) lines.push(cityStateZip);
  if (country && !lines.some((line) => line.toLowerCase() === country.trim().toLowerCase())) lines.push(country);
  return lines.join('\n');
};
const customerStreet = (address = {}) => [address.line1, address.line2].filter(Boolean).join('\n');

function InvoicePreview({ invoice, totals }) {
  const interstate = invoice.taxMode === 'Inter-state';
  const gstRates = [...new Set(invoice.lines.map((line) => Number(line.gst) || 0))];
  const singleGstRate = gstRates.length === 1 ? gstRates[0] : null;
  return <article className="invoice-paper" id="invoice-paper" data-invoice-id={invoice.id}>
    <header className="invoice-brand-row">
      <div className={`invoice-brand-mark ${invoice.logo ? 'has-logo' : ''}`} aria-hidden="true">{invoice.logo ? <img src={invoice.logo} alt=""/> : <span>LOGO</span>}</div>
      <div className="invoice-company"><strong>{invoice.company || 'Your Company Name'}</strong><div>{formatAddress(invoice.companyAddress, invoice.companyCity, invoice.companyState, invoice.companyCountry, invoice.companyZip)}</div>{invoice.companyPhone && <div>{invoice.companyPhone}</div>}{invoice.companyEmail && <div>{invoice.companyEmail}</div>}{invoice.companyWebsite && <div>{invoice.companyWebsite}</div>}{invoice.companyGstin && <div>GSTIN {invoice.companyGstin}</div>}</div>
      <h2>TAX INVOICE</h2>
    </header>
    <section className="invoice-meta">
      <div className="invoice-meta-left"><div><span>#</span><b>{invoice.id}</b></div><div><span>Invoice Date</span><b>{dateLabel(invoice.date)}</b></div><div><span>Terms</span><b>{invoice.terms || '—'}</b></div><div><span>Due Date</span><b>{dateLabel(invoice.dueDate)}</b></div></div>
      <div className="invoice-supply"><span>Place Of Supply</span><b>{invoice.supplyState || '—'}</b></div>
    </section>
    <section className="invoice-addresses"><div><h3>Bill To</h3><b>{invoice.customer || 'Customer name'}</b>{invoice.customerPhone && <p>{invoice.customerPhone}</p>}{invoice.customerEmail && <p>{invoice.customerEmail}</p>}<p>{formatAddress(invoice.customerAddress, invoice.customerCity, invoice.customerState, invoice.customerCountry, invoice.customerZip) || 'Customer address'}</p>{invoice.customerGstin && <p>GSTIN {invoice.customerGstin}</p>}</div><div><h3>Ship To</h3><p>{invoice.shipTo ? formatAddress(invoice.shipTo, invoice.shipToCity, invoice.shipToState, invoice.shipToCountry, invoice.shipToZip) : formatAddress(invoice.customerAddress, invoice.customerCity, invoice.customerState, invoice.customerCountry, invoice.customerZip) || 'Same as billing address'}</p></div></section>
    <div className="invoice-table-wrap"><table className="invoice-table"><thead><tr><th rowSpan="2">#</th><th rowSpan="2">Item &amp; Description</th><th rowSpan="2">HSN/SAC</th><th rowSpan="2" className="right">Qty</th><th rowSpan="2" className="right">Rate</th><th colSpan="2" className="center">{interstate ? 'IGST' : 'CGST / SGST'}</th><th rowSpan="2" className="right">Amount</th></tr><tr><th className="right">%</th><th className="right">Amt</th></tr></thead><tbody>{invoice.lines.map((line, i) => { const tax = invoiceLineAmount(line) * Number(line.gst || 0) / 100; return <tr key={i}><td>{i + 1}</td><td>{line.description || 'Item description'}{line.unit && <small>{line.unit}</small>}</td><td>{line.hsn || '—'}</td><td className="right">{line.qty || 0} {line.unit}</td><td className="right">{money(line.rate)}</td><td className="right">{line.gst || 0}%</td><td className="right">{money(tax)}</td><td className="right">{money(invoiceLineAmount(line))}</td></tr>; })}</tbody></table></div>
    <section className="invoice-bottom"><div className="invoice-notes"><span>Total In Words</span><strong><em>Indian Rupee {words(totals.gross)} Only</em></strong><h4>Notes</h4><p>{invoice.notes || '—'}</p><div className="invoice-bank"><b>{invoice.company || 'Your Company Name'}</b>{invoice.bank && <span>Bank Name: {invoice.bank}</span>}{invoice.account && <span>Account No.: {invoice.account}</span>}{invoice.ifsc && <span>IFSC: {invoice.ifsc}</span>}{invoice.branch && <span>Branch: {invoice.branch}</span>}</div></div>
      <div className="invoice-summary"><div><span>Sub Total</span><b>{money(totals.subtotal)}</b></div>{interstate ? <div><span>IGST{singleGstRate !== null ? ` (${singleGstRate}%)` : ''}</span><b>{money(totals.tax)}</b></div> : <><div><span>CGST{singleGstRate !== null ? ` (${singleGstRate / 2}%)` : ''}</span><b>{money(totals.tax / 2)}</b></div><div><span>SGST{singleGstRate !== null ? ` (${singleGstRate / 2}%)` : ''}</span><b>{money(totals.tax / 2)}</b></div></>}<div className="invoice-grand"><span>Total</span><b>{money(totals.gross)}</b></div>{Number(invoice.credits) > 0 && <div><span>Credits Applied</span><b className="credit-value">(−) {money(invoice.credits)}</b></div>}<div className="invoice-balance"><span>Balance Due</span><b>{money(totals.total)}</b></div>
        <div className="invoice-signature">{invoice.signatureLogo ? <img className="invoice-signature-logo" src={invoice.signatureLogo} alt="Authorized signature logo"/> : <div className="signature-seal"><span>{(invoice.company || 'SP').split(' ').map((x) => x[0]).join('').slice(0, 3)}</span><small>AUTHORIZED</small></div>}<span>Authorized Signature</span></div>
      </div></section>
    <footer className="invoice-footer">This is a computer-generated invoice.</footer>
  </article>;
}

export default function Billing() {
  const [invoices, setInvoices] = useState(readInvoices);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');
  const autoSaveRevision = useRef(0);
  const autoSaveQueue = useRef(Promise.resolve());
  const [businessSettings, setBusinessSettings] = useState(readSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All invoices');
  const [tab, setTab] = useState('Details');
  const { hasPermission } = useAuth();
  const canLookupCustomers = hasPermission('customers.lookup') || hasPermission('customers.view');
  const toast = useToast();
  useEffect(() => {
    let mounted = true;
    const localSettings = readSettings();
    const loadSettings = async () => {
      try {
        const result = await billingService.getBusinessSettings();
        const settings = normalizeSettings(result.settings || localSettings);
        if (!result.settings) await billingService.saveBusinessSettings(settings);
        if (mounted) {
          setBusinessSettings(settings);
          try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* account copy is saved */ }
        }
      } catch {
        if (mounted) setBusinessSettings(localSettings);
      }
    };
    loadSettings();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!invoice) return undefined;
    const revision = ++autoSaveRevision.current;
    const draftTotals = calculateInvoiceTotals(invoice);
    const localDraft = { ...invoice, subtotal: draftTotals.subtotal, total: draftTotals.total, updatedAt: new Date().toISOString() };
    try {
      const cached = readInvoices();
      const next = [localDraft, ...cached.filter((item) => item.id !== localDraft.id)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* keep editing even if local storage is unavailable */ }
    const validationError = validateInvoice(invoice);
    if (validationError) {
      setAutoSaveStatus(`Draft saved on this device · ${validationError}`);
      return undefined;
    }
    setAutoSaveStatus('Unsaved changes');
    const timer = window.setTimeout(() => {
      const totals = calculateInvoiceTotals(invoice);
      const snapshot = { ...invoice, subtotal: totals.subtotal, total: totals.total, updatedAt: new Date().toISOString() };
      setAutoSaveStatus('Saving changes…');
      const request = autoSaveQueue.current.catch(() => {}).then(() => billingService.save(snapshot));
      autoSaveQueue.current = request;
      request.then((result) => {
        if (revision !== autoSaveRevision.current) return;
        const persisted = result.invoice || snapshot;
        setInvoices((current) => {
          const next = [persisted, ...current.filter((item) => item.id !== persisted.id)];
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* server save succeeded */ }
          return next;
        });
        setAutoSaveStatus('All changes saved');
      }).catch(() => {
        if (revision === autoSaveRevision.current) setAutoSaveStatus('Could not sync changes to your account; draft remains on this device');
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [invoice]);
  useEffect(() => {
    let mounted = true;
    const loadHistory = async () => {
      const cached = readInvoices();
      try {
        const remoteResult = await billingService.list();
        let remote = remoteResult.invoices || [];
        const remoteIds = new Set(remote.map((item) => item.id));
        const legacy = cached.filter((item) => !remoteIds.has(item.id));
        const migrations = await Promise.allSettled(legacy.map((item) => billingService.save(item)));
        if (migrations.some((result) => result.status === 'fulfilled')) remote = (await billingService.list()).invoices || remote;
        const byId = new Map(cached.map((item) => [item.id, item]));
        remote.forEach((item) => {
          const cachedItem = byId.get(item.id);
          const remoteTime = Date.parse(item.updatedAt || item.date) || 0;
          const cachedTime = Date.parse(cachedItem?.updatedAt || cachedItem?.date) || 0;
          if (!cachedItem || remoteTime >= cachedTime) byId.set(item.id, item);
        });
        const merged = [...byId.values()].sort((a, b) => String(b.updatedAt || b.date).localeCompare(String(a.updatedAt || a.date)));
        if (mounted) {
          setInvoices(merged);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* server remains the source of truth */ }
          if (migrations.some((result) => result.status === 'rejected')) toast.warning('Some older invoices are still only in this browser and could not sync to the server.');
        }
      } catch {
        if (mounted) {
          setInvoices(cached);
          toast.error(cached.length ? 'Server history is unavailable. Showing invoices saved in this browser.' : 'Could not load invoice history from the server. Check your connection and try again.');
        }
      } finally { if (mounted) setHistoryLoading(false); }
    };
    loadHistory();
    return () => { mounted = false; };
  }, []);
  const totals = useMemo(() => {
    if (!invoice) return { subtotal: 0, tax: 0, gross: 0, total: 0 };
    return calculateInvoiceTotals(invoice);
  }, [invoice]);
  const visible = invoices.filter((item) => `${item.id} ${item.customer}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All invoices' || item.status === filter));
  const save = async () => {
    const validationError = validateInvoice(invoice);
    if (validationError) { setSaveError(validationError); toast.error(validationError); setTab(validationError.startsWith('Add a customer') ? 'Details' : 'Items'); return; }
    const saved = { ...invoice, subtotal: totals.subtotal, total: totals.total, updatedAt: new Date().toISOString() };
    setSaving(true);
    try {
      const result = await billingService.save(saved);
      const persisted = result.invoice || saved;
      const next = [persisted, ...invoices.filter((item) => item.id !== persisted.id)];
      setInvoices(next); setInvoice(persisted); setSaveError('');
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* server save succeeded */ }
      toast.success('Invoice saved to billing history. Go back to Billing to see it in the list.');
    } catch {
      const next = [saved, ...invoices.filter((item) => item.id !== saved.id)];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setInvoices(next); setInvoice(saved); setSaveError('');
        toast.error('Invoice saved only in this browser. Server history could not be reached, so it may not appear on other devices.');
      } catch { toast.error('Invoice could not be saved. The server is unavailable and browser storage is full.'); }
    } finally { setSaving(false); }
  };
  const applySavedDetails = async () => {
    const updated = {
      ...invoice,
      company: businessSettings.company,
      companyGstin: businessSettings.companyGstin,
      companyAddress: businessSettings.companyAddress,
      companyCity: businessSettings.companyCity,
      companyState: businessSettings.companyState,
      companyCountry: businessSettings.companyCountry,
      companyZip: businessSettings.companyZip,
      companyPhone: businessSettings.companyPhone,
      companyEmail: businessSettings.companyEmail,
      companyWebsite: businessSettings.companyWebsite,
      logo: businessSettings.logo,
      signatureLogo: businessSettings.signatureLogo,
      bank: businessSettings.bank,
      account: businessSettings.account,
      ifsc: businessSettings.ifsc,
      branch: businessSettings.branch,
      terms: businessSettings.terms,
      supplyState: String(businessSettings.supplyState || '').trim() || emptySettings.supplyState,
      taxMode: businessSettings.taxMode,
    };
    setInvoice(updated);
    const validationError = validateInvoice(updated);
    if (validationError) {
      setSaveError(validationError);
      toast.success('Saved business details applied. Complete the invoice and save it to history.');
      return;
    }
    const updatedTotals = calculateInvoiceTotals(updated);
    const saved = { ...updated, subtotal: updatedTotals.subtotal, total: updatedTotals.total, updatedAt: new Date().toISOString() };
    setSaving(true);
    try {
      const result = await billingService.save(saved);
      const persisted = result.invoice || saved;
      const next = [persisted, ...invoices.filter((item) => item.id !== persisted.id)];
      setInvoices(next);
      setInvoice(persisted);
      setSaveError('');
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* server save succeeded */ }
      toast.success('Saved business details applied and invoice updated in billing history.');
    } catch {
      setInvoice(saved);
      toast.warning('Details are applied in this invoice, but the server could not save the update. Click Save invoice to retry.');
    } finally { setSaving(false); }
  };
  const update = (key, value) => { setSaveError(''); setInvoice((current) => ({ ...current, [key]: value })); };
  const selectInvoiceCustomer = (customer) => {
    setInvoice((current) => ({
      ...current,
      customer: customer.fullName || '',
      customerPhone: customer.phone || customer.alternatePhone || '',
      customerEmail: customer.email || '',
      customerAddress: customerStreet(customer.address),
      customerCity: customer.address?.city || '',
      customerState: customer.address?.state || '',
      customerCountry: customer.address?.country || '',
      customerZip: customer.address?.pincode || '',
      customerGstin: customer.gstNumber || '',
      shipTo: '',
      shipToCity: '',
      shipToState: '',
      shipToCountry: '',
      shipToZip: '',
    }));
    setSaveError('');
  };
  const updateLine = (i, key, value) => { setSaveError(''); setInvoice((current) => ({ ...current, lines: current.lines.map((line, index) => index === i ? { ...line, [key]: value } : line) })); };
  const removeInvoice = async (id) => {
    const next = invoices.filter((item) => item.id !== id);
    try {
      if (invoices.find((item) => item.id === id)?._id) await billingService.remove(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setInvoices(next); return true;
    } catch { toast.error('Could not remove the invoice from billing history. Check your connection and try again.'); return false; }
  };
  const startNew = () => { setSaveError(''); setInvoice(freshInvoice(businessSettings)); setTab('Details'); };
  const createInvoicePdf = async (item) => {
    try {
      await downloadInvoicePdf(item, calculateInvoiceTotals(item));
      toast.success(`PDF downloaded: ${item.id}.pdf`);
    } catch {
      toast.error(`Could not download the PDF for ${item.id}. Check the app's download permission and try again.`);
    }
  };
  const downloadPdfFromHistory = (item) => createInvoicePdf(item);
  const printInvoice = async (item = invoice) => {
    if (!item) return;
    const embeddedVsCode = /Electron|VSCode/i.test(navigator.userAgent) || /^(vscode-webview|vscode-file):$/.test(window.location.protocol);
    if (embeddedVsCode) {
      try {
        await downloadInvoicePdf(item, calculateInvoiceTotals(item));
        toast.info(`VS Code print preview is unsupported. Open ${item.id}.pdf in Edge or Chrome to preview and print.`);
      } catch {
        toast.error(`Could not download the PDF for ${item.id}.`);
      }
      return;
    }
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) {
      toast.error('Invoice preview was blocked. Allow pop-ups for this app and try Print again.');
      return;
    }
    openInvoicePdfPreview(item, calculateInvoiceTotals(item), previewWindow)
      .then(() => toast.info('Invoice preview opened. Use the PDF viewer’s print button to print.'))
      .catch(() => toast.error(`Could not open the print preview for ${item.id}.`));
  };
  const saveSettings = async () => {
    const settings = normalizeSettings(businessSettings);
    setBusinessSettings(settings);
    try {
      await billingService.saveBusinessSettings(settings);
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* account copy is saved */ }
      setShowSettings(false);
      toast.success('Business details and logos saved to your account. They will be used on new invoices.');
    } catch {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        setShowSettings(false);
        toast.warning('Settings saved only in this browser. Account sync failed.');
      } catch { toast.error('Could not save business settings.'); }
    }
  };
  const updateSetting = (key, value) => setBusinessSettings((current) => ({ ...current, [key]: value }));
  const uploadLogo = (file, settingKey = 'logo') => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose an image file for your logo.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 700 / image.width, 400 / image.height);
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        updateSetting(settingKey, canvas.toDataURL('image/webp', 0.84));
      };
      image.onerror = () => toast.error('That image could not be loaded.');
      image.src = reader.result;
    };
    reader.onerror = () => toast.error('Unable to read that image.');
    reader.readAsDataURL(file);
  };
  const field = (label, key, { type = 'text', placeholder = '', wide = false } = {}) => <label className={`billing-field ${wide ? 'billing-field-wide' : ''}`} key={key}><span>{label}</span><input type={type} value={invoice[key] ?? ''} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} /></label>;

  if (showSettings) return <div className="billing-page billing-settings-page"><div className="billing-editor-top"><button className="billing-back" onClick={() => setShowSettings(false)}><ArrowLeft size={17}/> Billing</button><Button icon={Check} onClick={saveSettings}>Save settings</Button></div><div className="billing-settings-heading"><span><Settings2 size={20}/></span><div><h1>Business settings</h1><p>Set your business information once. It will be filled in automatically on every new invoice.</p></div></div><div className="billing-settings-layout"><Card className="billing-settings-card"><h2>Business profile</h2><p className="billing-settings-subtitle">These details appear in the invoice header and signature area.</p><div className="billing-logo-upload-grid">{[['logo','Company logo','Shown in the invoice header.'],['signatureLogo','Signature / seal logo','Shown in the lower authorized signature area.']].map(([key,label,description])=><div className="billing-logo-setting" key={key}><div className="billing-logo-preview">{businessSettings[key] ? <img src={businessSettings[key]} alt={`${label} preview`}/> : <span>LOGO</span>}</div><div><b>{label}</b><p>{description} PNG, JPG, or WebP; resized for printing.</p><label className="billing-upload-button"><Upload size={15}/> Choose image<input type="file" accept="image/*" onChange={(e) => { uploadLogo(e.target.files?.[0], key); e.target.value = ''; }}/></label>{businessSettings[key] && <button className="billing-remove-logo" onClick={() => updateSetting(key, '')}><X size={13}/> Remove logo</button>}</div></div>)}</div><div className="billing-form-grid">{[['Company / legal name','company'],['GSTIN','companyGstin'],['Phone','companyPhone'],['Email','companyEmail'],['Website','companyWebsite'],['Default place of supply','supplyState']].map(([label,key])=><label className="billing-field" key={key}><span>{label}</span><input type={key==='companyEmail'?'email':'text'} value={businessSettings[key]} onChange={(e)=>updateSetting(key,e.target.value)} placeholder={label}/></label>)}<label className="billing-field billing-field-wide"><span>Street address</span><textarea rows="3" value={businessSettings.companyAddress} onChange={(e)=>updateSetting('companyAddress',e.target.value)} placeholder="Street address"/></label>{[['City','companyCity'],['State','companyState'],['Country','companyCountry'],['ZIP / PIN code','companyZip']].map(([label,key])=><label className="billing-field" key={key}><span>{label}</span><input value={businessSettings[key] || ''} onChange={(e)=>updateSetting(key,e.target.value)} placeholder={label}/></label>)}<label className="billing-field"><span>Default payment terms</span><select value={businessSettings.terms} onChange={(e)=>updateSetting('terms',e.target.value)}>{['Due on Receipt','Net 7','Net 15','Net 30','Net 45'].map((x)=><option key={x}>{x}</option>)}</select></label><label className="billing-field"><span>Default GST treatment</span><select value={businessSettings.taxMode} onChange={(e)=>updateSetting('taxMode',e.target.value)}><option>Intra-state</option><option>Inter-state</option></select></label></div></Card><Card className="billing-settings-card"><h2>Bank details</h2><p className="billing-settings-subtitle">Your payment instructions appear in the invoice footer.</p><div className="billing-form-grid">{[['Bank name','bank'],['Account number','account'],['IFSC code','ifsc'],['Branch','branch']].map(([label,key])=><label className="billing-field" key={key}><span>{label}</span><input value={businessSettings[key]} onChange={(e)=>updateSetting(key,e.target.value)} placeholder={label}/></label>)}</div></Card></div><p className="billing-storage-note">Saved to your account. New invoices use these details; apply them to an existing invoice with Apply saved details.</p></div>;

  if (!invoice) return <div className="billing-page"><PageHeader title="Billing" description="Create, manage, and print GST invoices." breadcrumbs={[{ label: 'Sales' }, { label: 'Billing' }]} actions={<><Button variant="secondary" icon={Settings2} onClick={() => setShowSettings(true)}>Business settings</Button><Button icon={Plus} onClick={startNew}>New invoice</Button></>} />
    <div className="billing-kpis"><Card><span>Invoices</span><strong>{invoices.length}</strong><small>Saved on this device</small></Card><Card><span>Paid</span><strong>{invoices.filter((x) => x.status === 'Paid').length}</strong><small>Marked as collected</small></Card><Card><span>Outstanding</span><strong>{money(invoices.filter((x) => x.status !== 'Paid').reduce((s, x) => s + Number(x.total || 0), 0))}</strong><small>Unpaid invoice balance</small></Card></div>
    <Card className="billing-list-card"><div className="billing-list-head"><div><h2>Invoices</h2><p>Open an invoice to edit its details</p></div><div className="billing-filters"><label className="billing-search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoices" /></label><label className="billing-select"><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>All invoices</option><option>Paid</option><option>Unpaid</option></select><ChevronDown size={14}/></label></div></div>
      {historyLoading ? <div className="billing-empty"><b>Loading invoice history&hellip;</b></div> : visible.length ? <div className="billing-list">{visible.map((item) => <div className="billing-row-wrap" key={item.id}><button className="billing-row" onClick={() => { setTab('Details'); setInvoice(item); }}><span className="billing-row-icon"><FileText size={18}/></span><span className="billing-row-main"><b>{item.id}</b><small>{item.customer || 'Unnamed customer'} &#183; {dateLabel(item.date)}</small></span><span className={`billing-status ${item.status === 'Paid' ? 'is-paid' : ''}`}><i/>{item.status}</span><b className="billing-row-total">{money(item.total)}</b><span className="billing-row-chevron">Edit</span></button><div className="billing-row-actions"><button aria-label={`Print invoice ${item.id}`} title="Open print preview" onClick={() => printInvoice(item)}><Printer size={15}/><span>Print</span></button><button aria-label={`Save invoice ${item.id} as PDF`} title="Save as PDF" onClick={() => downloadPdfFromHistory(item)}><Download size={15}/><span>PDF</span></button></div></div>)}</div> : <div className="billing-empty"><span><FileText/></span><b>No invoices yet</b><p>Create your first invoice and it will appear here.</p><Button icon={Plus} onClick={startNew}>Create invoice</Button></div>}
    </Card>
    <p className="billing-storage-note">Invoices are stored in this browser on this device.</p>
  </div>;

  return <div className="billing-page billing-editor-page"><div className="billing-editor-top"><button className="billing-back" onClick={() => setInvoice(null)}><ArrowLeft size={17}/> Billing</button><div className="billing-editor-actions"><span className="billing-draft-label"><i/> {autoSaveStatus || (invoices.some((x) => x.id === invoice.id) ? 'Saved invoice' : 'New invoice')}</span><Button variant="secondary" onClick={applySavedDetails} loading={saving}>Apply &amp; save details</Button><Button variant="secondary" icon={Printer} onClick={() => printInvoice(invoice)}>Print</Button><Button icon={Check} onClick={save} loading={saving}>Save invoice</Button></div></div>
    <div className="billing-editor-heading"><div><h1>{invoices.some((item) => item.id === invoice.id) ? 'Edit invoice' : 'Create invoice'}</h1><p>Edit fields in the form on the left; the invoice preview updates as you type.</p></div><div className="billing-editor-number"><span>Invoice number</span><b>{invoice.id}</b></div></div>
    <div className="billing-workspace"><section className="billing-form-panel"><div className="billing-tabs">{['Details', 'Items', 'Bank & notes'].map((name) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>{saveError && <div className="billing-validation-alert" role="alert">{saveError}</div>}
      {tab === 'Details' && <div className="billing-form-content"><div className="billing-section-title"><span className="billing-step">01</span><div><h2>Invoice details</h2><p>Business, dates, and customer information</p></div></div><div className="billing-form-grid">{field('Business name', 'company', { placeholder: 'Your registered business name' })}{field('GSTIN', 'companyGstin', { placeholder: '15 character GSTIN' })}{field('Business address', 'companyAddress', { wide: true, placeholder: 'Street address' })}{field('Business city', 'companyCity', { placeholder: 'City' })}{field('Business state', 'companyState', { placeholder: 'State' })}{field('Business country', 'companyCountry', { placeholder: 'Country' })}{field('Business ZIP / PIN code', 'companyZip', { placeholder: 'ZIP / PIN code' })}{field('Phone', 'companyPhone', { type: 'tel' })}{field('Email', 'companyEmail', { type: 'email' })}{field('Invoice date', 'date', { type: 'date' })}{field('Due date', 'dueDate', { type: 'date' })}<label className="billing-field"><span>Payment terms</span><select value={invoice.terms} onChange={(e) => update('terms', e.target.value)}>{['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45'].map((x) => <option key={x}>{x}</option>)}</select></label>{field('Place of supply', 'supplyState', { placeholder: 'e.g. Uttar Pradesh (09)' })}<label className="billing-field"><span>Tax treatment</span><select value={invoice.taxMode} onChange={(e) => update('taxMode', e.target.value)}><option>Intra-state</option><option>Inter-state</option></select></label><label className="billing-field"><span>Payment status</span><select value={invoice.status} onChange={(e) => update('status', e.target.value)}><option>Unpaid</option><option>Paid</option></select></label></div><div className="billing-section-title billing-customer-title"><span className="billing-step">02</span><div><h2>Customer</h2><p>Billing and delivery information</p></div></div><div className="billing-form-grid">{canLookupCustomers ? <CustomerLookup label="Customer / business name" value={invoice.customer} onChange={(value) => update('customer', value)} onSelect={selectInvoiceCustomer} placeholder="Search by name, phone, email or GSTIN" /> : field('Customer / business name', 'customer', { placeholder: 'Customer name' })}{field('Customer phone', 'customerPhone', { type: 'tel' })}{field('Customer email', 'customerEmail', { type: 'email' })}{field('Customer GSTIN', 'customerGstin', { placeholder: 'Optional' })}{field('Bill to address', 'customerAddress', { wide: true, placeholder: 'Street address' })}{field('Bill to city', 'customerCity', { placeholder: 'City' })}{field('Bill to state', 'customerState', { placeholder: 'State' })}{field('Bill to country', 'customerCountry', { placeholder: 'Country' })}{field('Bill to ZIP / PIN code', 'customerZip', { placeholder: 'ZIP / PIN code' })}{field('Ship to address', 'shipTo', { wide: true, placeholder: 'Leave blank to use billing address' })}{field('Ship to city', 'shipToCity', { placeholder: 'City' })}{field('Ship to state', 'shipToState', { placeholder: 'State' })}{field('Ship to country', 'shipToCountry', { placeholder: 'Country' })}{field('Ship to ZIP / PIN code', 'shipToZip', { placeholder: 'ZIP / PIN code' })}</div></div>}
      {tab === 'Items' && <div className="billing-form-content"><div className="billing-section-title"><span className="billing-step">03</span><div><h2>Items &amp; tax</h2><p>Add products, quantities, rates, and GST</p></div></div><div className="billing-item-edit-head"><span>DESCRIPTION</span><span>QTY</span><span>RATE (₹)</span><span>GST</span><span/></div>{invoice.lines.map((line, i) => <div className="billing-item-edit" key={i}><div className="billing-item-description"><input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="Item description"/><input value={line.hsn} onChange={(e) => updateLine(i, 'hsn', e.target.value)} placeholder="HSN / SAC" aria-label="HSN / SAC"/><input value={line.unit || ''} onChange={(e) => updateLine(i, 'unit', e.target.value)} placeholder="Unit e.g. kg, pcs" aria-label="Unit"/></div><input type="number" min="0" step="0.001" value={line.qty} onChange={(e) => updateLine(i, 'qty', e.target.value)} aria-label="Quantity"/><input type="number" min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(i, 'rate', e.target.value)} placeholder="0.00" aria-label="Rate"/><select value={line.gst} onChange={(e) => updateLine(i, 'gst', e.target.value)} aria-label="GST rate">{[0, 5, 12, 18, 28].map((x) => <option key={x} value={x}>{x}%</option>)}</select><button className="billing-remove-line" aria-label="Remove item" onClick={() => update('lines', invoice.lines.filter((_, index) => index !== i))} disabled={invoice.lines.length === 1}><Trash2 size={16}/></button><small className="billing-line-total">Line total incl. GST <b>{money(invoiceLineAmount(line) * (1 + Number(line.gst || 0) / 100))}</b></small></div>)}<button className="billing-add-line" onClick={() => update('lines', [...invoice.lines, newLine()])}><Plus size={16}/> Add line item</button><div className="billing-live-total"><span>Invoice total</span><b>{money(totals.total)}</b></div></div>}
      {tab === 'Bank & notes' && <div className="billing-form-content"><div className="billing-section-title"><span className="billing-step">04</span><div><h2>Payment details</h2><p>Show your bank details and a note on the invoice</p></div></div><div className="billing-form-grid">{field('Bank name', 'bank')}{field('Account number', 'account')}{field('IFSC code', 'ifsc')}{field('Branch', 'branch')}{field('Website', 'companyWebsite')}{field('Credits applied (₹)', 'credits', { type: 'number' })}<label className="billing-field billing-field-wide"><span>Notes</span><textarea value={invoice.notes} onChange={(e) => update('notes', e.target.value)} rows={3} placeholder="Thank you for your business."/></label></div><div className="billing-payment-hint"><Check size={16}/><span>Payment information appears alongside the invoice totals.</span></div></div>}
      <div className="billing-form-footer"><span><i/> Save stores the invoice in your account history</span>{tab !== 'Bank & notes' ? <Button variant="secondary" onClick={() => setTab(tab === 'Details' ? 'Items' : 'Bank & notes')}>Continue <span aria-hidden="true">→</span></Button> : <Button onClick={save} icon={Check} loading={saving}>Save invoice</Button>}</div>
    </section><aside className="billing-preview-panel"><div className="billing-preview-heading"><div><b>Live preview</b><span>Updates as you edit</span></div><button onClick={() => printInvoice(invoice)} aria-label="Open invoice print preview"><Printer size={17}/></button></div><div className="billing-preview-scroll"><InvoicePreview invoice={invoice} totals={totals}/></div></aside></div>
    {invoices.some((item) => item.id === invoice.id) && <div className="billing-delete-wrap"><button onClick={async () => { if (await removeInvoice(invoice.id)) { setInvoice(null); toast.success('Invoice removed.'); } }}>Delete invoice</button></div>}
  </div>;
}
