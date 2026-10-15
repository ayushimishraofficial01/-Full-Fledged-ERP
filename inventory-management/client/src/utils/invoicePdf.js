const escapeXml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
const dateLabel = (value) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value || '—';
const amountWords = (value) => {
  const small = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const underThousand = (number) => {
    const out = [];
    if (number >= 100) { out.push(`${small[Math.floor(number / 100)]} Hundred`); number %= 100; }
    if (number >= 20) { out.push(`${tens[Math.floor(number / 10)]}${number % 10 ? ` ${small[number % 10]}` : ''}`); number = 0; }
    if (number > 0) out.push(small[number]);
    return out.join(' ');
  };
  let number = Math.floor(Number(value) || 0);
  if (!number) return 'Zero';
  const parts = [];
  for (const [divider, label] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [100, 'Hundred']]) {
    const amount = Math.floor(number / divider);
    if (amount) parts.push(`${underThousand(amount)} ${label}`);
    number %= divider;
  }
  if (number) parts.push(underThousand(number));
  return parts.join(' ');
};
const wrap = (value, max = 62) => {
  const words = String(value || '').split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    if (line && `${line} ${word}`.length > max) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  });
  if (line) lines.push(line);
  return lines;
};
const formatAddress = (address, city, state, country, zip) => {
  const lines = String(address || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cityStateZip = [city, state, zip].filter(Boolean).join(', ');
  if (cityStateZip) lines.push(cityStateZip);
  if (country && !lines.some((line) => line.toLowerCase() === country.trim().toLowerCase())) lines.push(country);
  return lines.join('\n');
};
const t = (x, y, value, size = 12, weight = 400, anchor = 'start', extra = '') => `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size + 1}" font-weight="${weight}" text-anchor="${anchor}" fill="#20272c" ${extra}>${escapeXml(value)}</text>`;
const rect = (x, y, w, h, fill = '#fff', stroke = '#999') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"/>`;
const image = (src, x, y, w, h) => src ? `<image href="${escapeXml(src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>` : '';

function invoiceSvg(invoice, totals) {
  const width = 794;
  const pad = 54;
  const contentWidth = width - pad * 2;
  const leftWidth = contentWidth * 0.56;
  const rightX = pad + leftWidth;
  const itemsY = 390;
  const headerHeight = 38;
  const rowHeight = 36;
  const rows = invoice.lines || [];
  const tableBottom = itemsY + headerHeight + rows.length * rowHeight;
  const bottomY = tableBottom;
  const bottomHeight = 340;
  const height = Math.max(1123, bottomY + bottomHeight + 30);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/>`];
  for (let row = 0; row < 4; row += 1) for (let col = 0; col < 9; col += 1) {
    const colors = ['#e3f1ec', '#c8e8dc', '#9fd8c5', '#42b68e', '#168e72'];
    parts.push(`<rect x="${width - 168 + col * 19}" y="${row * 19}" width="11" height="11" fill="${colors[(row * 3 + col) % colors.length]}"/>`);
  }
  parts.push(rect(pad, 56, contentWidth, 150));
  parts.push(image(invoice.logo, pad + 24, 78, 108, 108));
  const companyLines = [invoice.company, ...formatAddress(invoice.companyAddress, invoice.companyCity, invoice.companyState, invoice.companyCountry, invoice.companyZip).split(/\r?\n/), invoice.companyGstin && `GSTIN ${invoice.companyGstin}`, invoice.companyPhone, invoice.companyEmail, invoice.companyWebsite].filter(Boolean);
  companyLines.slice(0, 7).forEach((line, index) => parts.push(t(pad + 150, 84 + index * 16, line, index === 0 ? 16 : 12, index === 0 ? 700 : 400)));
  parts.push(t(width - pad - 14, 188, 'TAX INVOICE', 29, 400, 'end'));
  parts.push(rect(pad, 206, contentWidth, 76));
  parts.push(`<line x1="${rightX}" y1="206" x2="${rightX}" y2="282" stroke="#999"/>`);
  [['#', invoice.id], ['Invoice Date', dateLabel(invoice.date)], ['Terms', invoice.terms], ['Due Date', dateLabel(invoice.dueDate)]].forEach(([label, value], index) => {
    parts.push(t(pad + 9, 224 + index * 17, label, 11));
    parts.push(t(pad + 174, 224 + index * 17, ':', 11, 700));
    parts.push(t(pad + 188, 224 + index * 17, value || '—', 11, 700));
  });
  parts.push(t(rightX + 9, 224, 'Place Of Supply', 11));
  parts.push(t(rightX + 152, 224, ':', 11, 700));
  parts.push(t(rightX + 164, 224, invoice.supplyState || '—', 11, 700));
  parts.push(rect(pad, 282, contentWidth, 121));
  parts.push(`<line x1="${rightX}" y1="282" x2="${rightX}" y2="403" stroke="#999"/>`);
  parts.push(`<rect x="${pad}" y="282" width="${leftWidth}" height="21" fill="#eee"/>`);
  parts.push(`<rect x="${rightX}" y="282" width="${contentWidth - leftWidth}" height="21" fill="#eee"/>`);
  parts.push(t(pad + 8, 297, 'Bill To', 12, 700));
  parts.push(t(rightX + 8, 297, 'Ship To', 12, 700));
  const customerLines = [invoice.customer, ...wrap(formatAddress(invoice.customerAddress, invoice.customerCity, invoice.customerState, invoice.customerCountry, invoice.customerZip), 45), invoice.customerGstin && `GSTIN ${invoice.customerGstin}`].filter(Boolean);
  customerLines.slice(0, 6).forEach((line, index) => parts.push(t(pad + 8, 322 + index * 15, line, 11, index === 0 ? 700 : 400)));
  const shippingAddress = invoice.shipTo
    ? formatAddress(invoice.shipTo, invoice.shipToCity, invoice.shipToState, invoice.shipToCountry, invoice.shipToZip)
    : formatAddress(invoice.customerAddress, invoice.customerCity, invoice.customerState, invoice.customerCountry, invoice.customerZip) || 'Same as billing address';
  wrap(shippingAddress, 43).slice(0, 6).forEach((line, index) => parts.push(t(rightX + 8, 322 + index * 15, line, 11)));
  const colWidths = [34, 210, 66, 72, 66, 48, 76, 114];
  const colX = [pad];
  colWidths.forEach((itemWidth, index) => { if (index < colWidths.length - 1) colX.push(colX[index] + itemWidth); });
  parts.push(rect(pad, itemsY, contentWidth, headerHeight, '#eee'));
  for (let index = 1; index < colX.length; index += 1) {
    const lineStartY = index === 6 ? itemsY + 17 : itemsY;
    parts.push(`<line x1="${colX[index]}" y1="${lineStartY}" x2="${colX[index]}" y2="${tableBottom}" stroke="#999"/>`);
  }
  const headers = ['#', 'Item & Description', 'HSN/SAC', 'Qty', 'Rate', '', '', 'Amount'];
  headers.forEach((label, index) => { if (label) parts.push(t(colX[index] + (index > 2 ? colWidths[index] - 5 : 5), itemsY + 24, label, 9, 700, index > 2 ? 'end' : 'start')); });
  parts.push(t(colX[5] + (colWidths[5] + colWidths[6]) / 2, itemsY + 12, invoice.taxMode === 'Inter-state' ? 'IGST' : 'CGST / SGST', 9, 700, 'middle'));
  parts.push(`<line x1="${colX[5]}" y1="${itemsY + 17}" x2="${colX[7]}" y2="${itemsY + 17}" stroke="#999"/>`);
  parts.push(t(colX[5] + colWidths[5] / 2, itemsY + 32, '%', 8, 700, 'middle'));
  parts.push(t(colX[6] + colWidths[6] / 2, itemsY + 32, 'Amt', 8, 700, 'middle'));
  parts.push(`<line x1="${pad}" y1="${itemsY + headerHeight}" x2="${width - pad}" y2="${itemsY + headerHeight}" stroke="#999"/>`);
  rows.forEach((line, index) => {
    const y = itemsY + headerHeight + index * rowHeight;
    parts.push(rect(pad, y, contentWidth, rowHeight));
    for (let col = 1; col < colX.length; col += 1) parts.push(`<line x1="${colX[col]}" y1="${y}" x2="${colX[col]}" y2="${y + rowHeight}" stroke="#999"/>`);
    const tax = (Number(line.qty) || 0) * (Number(line.rate) || 0) * (Number(line.gst) || 0) / 100;
    const values = [String(index + 1), line.description || 'Item description', line.hsn || '—', `${line.qty || 0} ${line.unit || ''}`.trim(), currency(line.rate), `${line.gst || 0}%`, currency(tax), currency((Number(line.qty) || 0) * (Number(line.rate) || 0))];
    values.forEach((value, col) => parts.push(t(col === 0 || col === 1 || col === 2 ? colX[col] + 5 : colX[col] + colWidths[col] - 5, y + 16, col === 1 ? wrap(value, 38)[0] : value, 9, 400, col > 2 ? 'end' : 'start')));
    if (line.description && wrap(line.description, 38).length > 1) parts.push(t(colX[1] + 5, y + 29, wrap(line.description, 38)[1], 8));
  });
  parts.push(rect(pad, bottomY, leftWidth, bottomHeight));
  parts.push(rect(rightX, bottomY, contentWidth - leftWidth, 92));
  parts.push(rect(rightX, bottomY + 92, contentWidth - leftWidth, bottomHeight - 92));
  parts.push(t(pad + 9, bottomY + 20, 'Total In Words', 11));
  wrap(`Indian Rupee ${amountWords(totals.gross)} Only`, 54).slice(0, 2).forEach((line, index) => parts.push(t(pad + 9, bottomY + 39 + index * 14, line, 11, 700, 'start', 'font-style="italic"')));
  parts.push(t(pad + 9, bottomY + 74, 'Notes', 11));
  wrap(invoice.notes || '—', 72).slice(0, 3).forEach((line, index) => parts.push(t(pad + 9, bottomY + 90 + index * 14, line, 10)));
  const bankLines = [invoice.company, invoice.bank && `Bank Name: ${invoice.bank}`, invoice.account && `Account No.: ${invoice.account}`, invoice.ifsc && `IFSC: ${invoice.ifsc}`, invoice.branch && `Branch: ${invoice.branch}`].filter(Boolean);
  bankLines.forEach((line, index) => parts.push(t(pad + 9, bottomY + 137 + index * 15, line, 10, index === 0 ? 700 : 400)));
  const rates = [...new Set(rows.map((line) => Number(line.gst) || 0))];
  const rateSuffix = rates.length === 1 ? ` (${rates[0]}%)` : '';
  const summary = [['Sub Total', currency(totals.subtotal)], [invoice.taxMode === 'Inter-state' ? `IGST${rateSuffix}` : `CGST + SGST${rateSuffix}`, currency(totals.tax)], ['Total', currency(totals.gross)], ...(Number(invoice.credits) > 0 ? [['Credits Applied', `(-) ${currency(invoice.credits)}`]] : []), ['Balance Due', currency(totals.total)]];
  summary.forEach(([label, value], index) => {
    const y = bottomY + 20 + index * 15;
    parts.push(t(rightX + 10, y, label, 10, index > 1 ? 700 : 400));
    parts.push(t(width - pad - 10, y, value, 10, 700, 'end'));
  });
  const signatureWidth = contentWidth - leftWidth;
  const signatureLogoWidth = 138;
  parts.push(image(invoice.signatureLogo, rightX + (signatureWidth - signatureLogoWidth) / 2, bottomY + 105, signatureLogoWidth, 138));
  parts.push(t(rightX + (contentWidth - leftWidth) / 2, bottomY + bottomHeight - 12, 'Authorized Signature', 9, 400, 'middle'));
  parts.push(t(width / 2, height - 28, 'This is a computer-generated invoice.', 9, 400, 'middle'));
  parts.push('</svg>');
  return parts.join('');
}

const base64ToBytes = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};
const ascii = (value) => new TextEncoder().encode(value);
const joinBytes = (chunks) => {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.length; });
  return output;
};

function createPdf(jpegBytes, imageWidth, imageHeight) {
  const chunks = [];
  const offsets = [0];
  let size = 0;
  const write = (bytes) => { chunks.push(bytes); size += bytes.length; };
  const object = (id, body) => { offsets[id] = size; write(ascii(`${id} 0 obj\n${body}\nendobj\n`)); };
  write(ascii('%PDF-1.4\n%âãÏÓ\n'));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4] = size;
  write(ascii(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`));
  write(jpegBytes);
  write(ascii('\nendstream\nendobj\n'));
  const contents = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ';
  object(5, `<< /Length ${contents.length} >>\nstream\n${contents}\nendstream`);
  const xrefOffset = size;
  const xref = [`xref\n0 6\n0000000000 65535 f \n`, ...offsets.slice(1, 6).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)].join('');
  write(ascii(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return new Blob([joinBytes(chunks)], { type: 'application/pdf' });
}

async function buildInvoicePdf(invoice, totals) {
  const svgMarkup = invoiceSvg(invoice, totals);
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const imageElement = new Image();
    imageElement.src = svgUrl;
    await imageElement.decode();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth * scale;
    canvas.height = imageElement.naturalHeight * scale;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
    return createPdf(base64ToBytes(jpeg), canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

const safeInvoiceFilename = (invoice) => `${String(invoice.id || 'invoice').replace(/[^a-z0-9_-]/gi, '-')}.pdf`;

export async function downloadInvoicePdf(invoice, totals) {
  const pdf = await buildInvoicePdf(invoice, totals);
  const downloadUrl = URL.createObjectURL(pdf);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = safeInvoiceFilename(invoice);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

export async function openInvoicePdfPreview(invoice, totals, previewWindow) {
  if (!previewWindow || previewWindow.closed) throw new Error('Invoice preview window was blocked.');
  try {
    previewWindow.document.title = safeInvoiceFilename(invoice);
    previewWindow.document.body.innerHTML = '<p style="font:16px Arial,sans-serif;padding:24px">Preparing invoice preview…</p>';
    const pdf = await buildInvoicePdf(invoice, totals);
    const previewUrl = URL.createObjectURL(pdf);
    previewWindow.location.replace(previewUrl);
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 30 * 60 * 1000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}
