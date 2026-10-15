import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import Button from './Button';
import { downloadFile, parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function ExportButton({ url, params, label = 'Export Excel', size = 'md', variant = 'secondary' }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const onClick = async () => {
    setBusy(true);
    try {
      const name = await downloadFile(url, params);
      toast.success(`Downloaded ${name}`);
    } catch (err) {
      toast.error(parseError(err, 'Export failed').message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant={variant} size={size} icon={FileSpreadsheet} loading={busy} onClick={onClick}>
      {label}
    </Button>
  );
}
