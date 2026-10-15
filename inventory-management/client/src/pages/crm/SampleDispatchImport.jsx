import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download, FileSpreadsheet, FileUp, RotateCcw, UploadCloud, XCircle } from 'lucide-react';
import { crmService } from '../../services';
import { downloadFile, parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, PageHeader, StatCard } from '../../components/ui';

export default function SampleDispatchImport() {
  const inputRef = useRef(null);
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const validRows = useMemo(() => preview?.rows.filter((row) => row.status === 'valid') || [], [preview]);

  function chooseFile(selected) {
    if (!selected) return;
    if (!/\.(xlsx|xls|csv)$/i.test(selected.name)) return setError('Choose an Excel (.xlsx, .xls) or CSV file.');
    if (selected.size > 10 * 1024 * 1024) return setError('File must be smaller than 10 MB.');
    setFile(selected);
    setPreview(null);
    setResult(null);
    setError('');
  }

  async function downloadTemplate() {
    try { await downloadFile('/crm/sample-dispatch/import/template'); }
    catch (err) { toast.error(parseError(err).message); }
  }

  async function validateFile() {
    if (!file) return setError('Choose a file first.');
    setBusy(true);
    setError('');
    try {
      const response = await crmService.previewSampleDispatchImport(file);
      setPreview(response);
    } catch (err) {
      setError(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    setBusy(true);
    try {
      const response = await crmService.commitSampleDispatchImport(validRows.map((row) => row.data));
      setResult(response);
      setConfirming(false);
      toast.success(response.message);
    } catch (err) {
      toast.error(parseError(err).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
  }

  const columns = [
    { key: 'row', header: 'Row' },
    { key: 'status', header: 'Validation', render: (row) => row.status === 'valid' ? <Badge tone="green">Valid</Badge> : <Badge tone="red">Error</Badge> },
    { key: 'customer', header: 'Customer', render: (row) => row.data.customerName || row.input.customerName || '—' },
    { key: 'products', header: 'Sample products', render: (row) => row.data.sampleProducts.map((item) => item.sku || item.product).join(', ') || row.input.sampleProducts || '—' },
    { key: 'date', header: 'Dispatch date', render: (row) => row.input.dispatchDate ? String(row.input.dispatchDate) : '—' },
    { key: 'messages', header: 'Issues', className: 'whitespace-normal min-w-[240px]', render: (row) => row.errors.join('; ') || '—' },
  ];

  return (
    <>
      <PageHeader
        title="Import Sample Dispatch"
        description="Validate the workbook before dispatch records are saved."
        breadcrumbs={[{ label: 'CRM' }, { label: 'Sample Dispatch', to: '/crm/sample-dispatch' }, { label: 'Import' }]}
        actions={<Button variant="secondary" icon={Download} onClick={downloadTemplate}>Download template</Button>}
      />
      {!preview && !result && (
        <Card title="Upload Excel or CSV" description="One row per dispatch. Put multiple items in Sample Products as SKU:Quantity:Unit; SKU:Quantity:Unit.">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="sample-dispatch-file" className="label">Dispatch workbook</label>
              <input ref={inputRef} id="sample-dispatch-file" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => chooseFile(event.target.files?.[0])} className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700" />
              {file && <p className="mt-1 text-xs text-slate-500">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
            </div>
            <Button icon={FileSpreadsheet} loading={busy} disabled={!file} onClick={validateFile}>Validate & preview</Button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <p>Required columns: Customer Name, Sample Products, Dispatch Date.</p>
            <p>Product SKUs and optional customer email/phone are matched against existing CRM records.</p>
          </div>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </Card>
      )}
      {preview && !result && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Rows read" value={String(preview.summary.totalRows)} icon={FileSpreadsheet} />
            <StatCard label="Valid rows" value={String(preview.summary.validRows)} icon={CheckCircle2} accent="green" />
            <StatCard label="Rows with errors" value={String(preview.summary.errorRows)} icon={XCircle} accent="red" />
          </div>
          <Card title={preview.fileName} description={`Worksheet: ${preview.sheetName}`} actions={<Button size="sm" variant="ghost" icon={RotateCcw} onClick={restart}>Choose another file</Button>}>
            <DataTable rows={preview.rows} rowKey={(row) => row.row} columns={columns} minWidth={900} empty={<EmptyState compact title="No data rows found" />} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">{preview.summary.errorRows ? `${preview.summary.errorRows} invalid row(s) will be skipped.` : 'All rows passed validation.'}</p>
              <Button variant="success" disabled={!validRows.length} onClick={() => setConfirming(true)}>Import {validRows.length} valid row{validRows.length === 1 ? '' : 's'}</Button>
            </div>
          </Card>
        </>
      )}
      {result && (
        <Card>
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <h2 className="mt-3 text-lg font-semibold">Import complete</h2>
            <p className="mt-1 text-sm text-slate-600">{result.message}</p>
            <div className="mt-5 flex gap-2"><Button variant="secondary" onClick={restart}><UploadCloud className="mr-2 h-4 w-4" />Import another file</Button><Link to="/crm/sample-dispatch"><Button icon={FileUp}>View dispatches</Button></Link></div>
          </div>
        </Card>
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={commitImport}
        loading={busy}
        tone="info"
        title="Confirm sample dispatch import"
        confirmLabel="Import dispatches"
        message={`Import ${validRows.length} valid dispatch record(s) from ${preview?.fileName}? Existing CRM customers will be linked by matching email or phone.`}
      />
    </>
  );
}
