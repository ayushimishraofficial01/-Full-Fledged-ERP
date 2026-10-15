import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, UploadCloud, Download, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, RotateCcw, FileDown, Info } from 'lucide-react';
import { importService } from '../../services';
import { downloadFile, parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useMeta } from '../../context/MetaContext';
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, PageHeader, Pagination, StatCard } from '../../components/ui';
import { downloadCsv } from '../../utils/csv';
import { formatInt, formatQty } from '../../utils/format';

const STEPS = ['Upload file', 'Review & validate', 'Import'];
const PAGE = 50;
const ACTIONS = { create: ['New product', 'blue'], stock: ['Add stock', 'slate'], update: ['Update + stock', 'violet'] };

function Stepper({ step }) {
  return (
    <ol className="mb-6 flex items-center gap-2 overflow-x-auto text-sm">
      {STEPS.map((s, i) => (
        <li key={s} className="flex shrink-0 items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
            {i < step ? '✓' : i + 1}
          </span>
          <span className={i === step ? 'font-medium text-slate-900' : 'text-slate-500'}>{s}</span>
          {i < STEPS.length - 1 && <span className="mx-2 h-px w-8 bg-slate-300 sm:w-16" />}
        </li>
      ))}
    </ol>
  );
}

export default function ProductImport() {
  const toast = useToast();
  const { refreshCategories } = useMeta();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [drag, setDrag] = useState(false);

  const step = result ? 2 : preview ? 1 : 0;

  const choose = (f) => {
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return setError('Please choose an Excel (.xlsx, .xls) or CSV file.');
    if (f.size > 10 * 1024 * 1024) return setError('File must be smaller than 10 MB.');
    setError('');
    setFile(f);
  };

  const runPreview = async () => {
    if (!file) return setError('Please choose a file first.');
    setBusy(true);
    setError('');
    try {
      const res = await importService.preview(file, updateExisting);
      setPreview(res);
      setFilter(res.summary.errorRows ? 'error' : 'all');
      setPage(1);
    } catch (err) {
      const p = parseError(err);
      setError(p.message);
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    if (!preview) return [];
    if (filter === 'error') return preview.rows.filter((r) => r.status === 'error');
    if (filter === 'valid') return preview.rows.filter((r) => r.status === 'valid');
    if (filter === 'warning') return preview.rows.filter((r) => r.warnings.length);
    return preview.rows;
  }, [preview, filter]);

  const validRows = preview?.rows.filter((r) => r.status === 'valid') || [];

  const commit = async () => {
    setBusy(true);
    try {
      const res = await importService.commit({ rows: validRows.map((r) => r.input), updateExisting, fileName: preview.fileName });
      setResult(res);
      setConfirming(false);
      refreshCategories();
      toast.success(res.message);
    } catch (err) {
      const p = parseError(err);
      toast.error(p.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const errorReport = () => {
    const errs = preview.rows.filter((r) => r.status === 'error' || r.warnings.length);
    downloadCsv(
      `import-errors-${preview.fileName.replace(/\.[^.]+$/, '')}.csv`,
      ['Row', 'Status', 'Product Name', 'SKU', 'Unit', 'Warehouse', 'Quantity', 'Errors', 'Warnings'],
      errs.map((r) => [r.row, r.status, r.input.name, r.input.sku, r.input.unit, r.input.warehouse, r.input.quantity, r.errors.join('; '), r.warnings.join('; ')])
    );
  };

  const restart = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
  };

  const template = async () => {
    try {
      await downloadFile('/import/template');
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Import Products"
        description="Upload an Excel sheet. Nothing is saved until you review the rows and confirm."
        breadcrumbs={[{ label: 'Products', to: '/products' }, { label: 'Import' }]}
        actions={<Button variant="secondary" icon={Download} onClick={template}>Download template</Button>}
      />
      <Stepper step={step} />

      {step === 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="Upload Excel">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files?.[0]); }}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              role="button"
              tabIndex={0}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${drag ? 'border-brand-400 bg-brand-50/60' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}
            >
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                {file ? <FileSpreadsheet className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
              </span>
              {file ? (
                <>
                  <p className="font-medium text-slate-900">{file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB · click to choose a different file</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-slate-900">Drop your Excel file here, or click to browse</p>
                  <p className="mt-1 text-xs text-slate-500">.xlsx, .xls or .csv · up to 10 MB · first sheet is read</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            <label className="mt-5 flex items-start gap-3 text-sm">
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>
                <span className="font-medium text-slate-800">Update existing product details</span>
                <span className="block text-slate-500">When a SKU already exists, overwrite its name, category, HSN, size, unit, price and minimum stock with the file values. Stock is added either way.</span>
              </span>
            </label>
            <div className="mt-6 flex justify-end">
              <Button onClick={runPreview} loading={busy} disabled={!file} icon={FileSpreadsheet}>Validate & preview</Button>
            </div>
          </Card>
          <Card title="Expected columns">
            <ul className="space-y-1.5 text-sm">
              {[['Product Name', true], ['SKU', true], ['Category', false], ['Brand', false], ['HSN', false], ['Size', false], ['Unit', true], ['Stock Unit', false], ['Warehouse', true], ['Quantity', true], ['Minimum Stock', false], ['Description', false], ['Price (INR)', false]].map(([c, req]) => (
                <li key={c} className="flex items-center justify-between">
                  <span className="text-slate-700">{c}</span>
                  {req ? <Badge tone="navy">Required</Badge> : <span className="text-xs text-slate-400">optional</span>}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              Repeat a SKU on several rows to stock it in several warehouses. Quantities are added to current stock and recorded as Stock In.
            </div>
          </Card>
        </div>
      )}

      {step === 1 && preview && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Rows read" value={formatInt(preview.summary.totalRows)} icon={FileSpreadsheet} />
            <StatCard label="Valid" value={formatInt(preview.summary.validRows)} icon={CheckCircle2} accent="green" />
            <StatCard label="With errors" value={formatInt(preview.summary.errorRows)} icon={XCircle} accent="red" />
            <StatCard label="With warnings" value={formatInt(preview.summary.warningRows)} icon={AlertTriangle} accent="amber" />
            <StatCard label="New products" value={formatInt(preview.summary.newProducts)} accent="blue" />
            <StatCard label="Existing SKUs" value={formatInt(preview.summary.existingProducts)} accent="violet" />
          </div>
          <Card
            padded={false}
            title={preview.fileName}
            description={`Sheet "${preview.sheetName}" · stock to add: ${preview.summary.quantityByUnit.map((u) => `${formatQty(u.quantity)} ${u.unit}`).join(', ') || 'none'}`}
            actions={
              <>
                {(preview.summary.errorRows > 0 || preview.summary.warningRows > 0) && <Button variant="secondary" size="sm" icon={FileDown} onClick={errorReport}>Download error report</Button>}
                <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={restart}>Choose another file</Button>
              </>
            }
          >
            <div className="flex flex-wrap gap-1 border-b border-slate-100 px-4 py-2.5">
              {[['all', 'All', preview.summary.totalRows], ['error', 'Errors', preview.summary.errorRows], ['warning', 'Warnings', preview.summary.warningRows], ['valid', 'Valid', preview.summary.validRows]].map(([k, l, n]) => (
                <button key={k} type="button" onClick={() => { setFilter(k); setPage(1); }} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${filter === k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {l} <span className="num opacity-70">{n}</span>
                </button>
              ))}
            </div>
            <DataTable
              minWidth={1100}
              dense
              rows={rows.slice((page - 1) * PAGE, page * PAGE)}
              rowKey={(r) => r.row}
              columns={[
                { key: 'row', header: 'Row', render: (r) => <span className="num text-slate-500">{r.row}</span> },
                { key: 'status', header: 'Status', render: (r) => (r.status === 'error' ? <Badge tone="red" dot>Error</Badge> : r.warnings.length ? <Badge tone="amber" dot>Warning</Badge> : <Badge tone="green" dot>Valid</Badge>) },
                { key: 'name', header: 'Product', render: (r) => <span className="font-medium text-slate-900">{r.data.name || <em className="text-red-500">missing</em>}</span> },
                { key: 'sku', header: 'SKU', render: (r) => (r.data.sku ? <span className="sku">{r.data.sku}</span> : '—') },
                { key: 'size', header: 'Size', render: (r) => `${r.data.size ?? ''} ${r.data.unit || r.input.unit || ''}`.trim() || '—' },
                { key: 'price', header: 'Price (INR)', render: (r) => r.data.price == null ? '—' : r.data.price },
                { key: 'wh', header: 'Warehouse', render: (r) => r.data.warehouseName || '—' },
                { key: 'qty', header: 'Quantity', align: 'right', render: (r) => <span className="num">{String(r.input.quantity) === '' ? '0' : String(r.input.quantity)} <span className="text-xs text-slate-500">{r.data.stockUnit || ''}</span></span> },
                { key: 'action', header: 'Action', render: (r) => r.status === 'valid' && <Badge tone={ACTIONS[r.action][1]}>{ACTIONS[r.action][0]}</Badge> },
                {
                  key: 'msg',
                  header: 'Messages',
                  className: 'whitespace-normal min-w-[280px]',
                  render: (r) => (
                    <ul className="space-y-0.5 text-xs">
                      {r.errors.map((m) => <li key={m} className="text-red-600">• {m}</li>)}
                      {r.warnings.map((m) => <li key={m} className="text-amber-700">• {m}</li>)}
                    </ul>
                  ),
                },
              ]}
              empty={<EmptyState compact title="No rows in this view" />}
            />
            <Pagination pagination={{ page, limit: PAGE, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / PAGE)) }} onPageChange={setPage} />
          </Card>
          <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8">
            <p className="text-sm text-slate-600">
              {preview.summary.errorRows > 0 ? (
                <><span className="font-medium text-red-600">{preview.summary.errorRows} row(s) have errors</span> and will be skipped. Fix them in the file and re-upload, or import the valid rows now.</>
              ) : (
                'All rows passed validation.'
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" icon={RotateCcw} onClick={runPreview} loading={busy}>Re-validate</Button>
              <Button variant="success" onClick={() => setConfirming(true)} disabled={!validRows.length}>
                Import {formatInt(validRows.length)} valid row{validRows.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 2 && result && (
        <Card>
          <div className="flex flex-col items-center py-8 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h2 className="text-lg font-semibold text-slate-900">Import completed</h2>
            <p className="mt-1 text-sm text-slate-500">Reference <span className="font-mono">{result.reference}</span></p>
            <dl className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[['Rows imported', result.rowsImported], ['Products created', result.productsCreated], ['Products updated', result.productsUpdated], ['Stock In entries', result.stockTransactions]].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-xs text-slate-500">{l}</dt>
                  <dd className="num text-2xl font-semibold text-slate-900">{formatInt(v)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={restart}>Import another file</Button>
              <Link to="/inventory"><Button variant="secondary">View inventory</Button></Link>
              <Link to="/products"><Button>Go to products</Button></Link>
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={commit}
        loading={busy}
        tone="info"
        title="Confirm import"
        confirmLabel="Confirm Import"
        message={`Import ${formatInt(validRows.length)} row(s) from ${preview?.fileName}? ${preview?.summary.newProducts || 0} new product(s) will be created and quantities will be added to current stock as Stock In transactions.${preview?.summary.errorRows ? ` ${preview.summary.errorRows} row(s) with errors will be skipped.` : ''}`}
      />
    </>
  );
}
