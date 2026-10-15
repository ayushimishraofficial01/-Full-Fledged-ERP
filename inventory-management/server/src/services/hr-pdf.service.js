function pdfText(value) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function slipLines(run) {
  const employee = run.employee || {};
  return [
    'GEN VYRO - SALARY SLIP',
    `Pay period: ${run.period}`,
    `Employee: ${employee.name || run.employeeName || 'Employee'}`,
    `Employee ID: ${employee.employeeId || run.employeeId || '-'}`,
    `Email: ${employee.email || '-'}`,
    `Department: ${employee.department || '-'}`,
    `Status: ${run.status}`,
    '',
    `Base salary: ${run.currency} ${Number(run.baseSalary || 0).toFixed(2)}`,
    ...((run.components || []).map((component) =>
      `${component.kind === 'deduction' ? 'Deduction' : 'Earning'} - ${component.name}: ${run.currency} ${Number(component.amount || 0).toFixed(2)}`
    )),
    `Gross pay: ${run.currency} ${Number(run.grossPay || 0).toFixed(2)}`,
    `Total deductions: ${run.currency} ${Number(run.totalDeductions || 0).toFixed(2)}`,
    `Net pay: ${run.currency} ${Number(run.netPay || 0).toFixed(2)}`,
    '',
    'This document is generated from an approved payroll record.',
  ];
}

function buildSalarySlipPdf(runs) {
  const pages = runs.map((run) => slipLines(run));
  const objects = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const contentIds = pageIds.map((id) => id + 1);
  objects[catalogId] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[pagesId] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  pages.forEach((lines, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    const commands = ['BT', '/F1 11 Tf', '50 780 Td'];
    lines.forEach((line, lineIndex) => {
      if (lineIndex) commands.push('0 -20 Td');
      commands.push(`(${pdfText(line)}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects[pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  });

  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(document, 'ascii');
    document += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, 'ascii');
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    document += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, 'ascii');
}

function buildReportPdf(report, kind) {
  const normalizedKind = kind === 'employee' ? 'employees'
    : ['daily', 'weekly', 'monthly'].includes(kind) ? 'attendance'
      : kind || 'summary';
  const definitions = {
    employees: {
      title: 'Employee report',
      rows: report.employees,
      values: (row) => [row.employeeId, row.name, row.department, row.designation, row.status],
    },
    attendance: {
      title: 'Attendance report',
      rows: report.attendance,
      values: (row) => [row.employee?.name || row.employeeName, row.date, row.checkInTime, row.checkOutTime, `${row.workingHoursMinutes || 0} minutes`, row.status],
    },
    leaves: {
      title: 'Leave report',
      rows: report.leaves,
      values: (row) => [row.employee?.name, row.leaveType?.name, row.startDate, row.endDate, `${row.days || 0} days`, row.status],
    },
    payroll: {
      title: 'Payroll report',
      rows: report.payroll,
      values: (row) => [row.employee?.name, row.period, row.currency, row.grossPay, row.totalDeductions, row.netPay, row.status],
    },
    late: {
      title: 'Late arrival report',
      rows: report.lateAttendance,
      values: (row) => [row.employee?.name, row.date, row.checkInTime, `${row.lateArrivalMinutes || 0} minutes late`],
    },
    absence: {
      title: 'Absence report',
      rows: report.absenceReport,
      values: (row) => [row.employee?.name, row.date, row.status],
    },
    overtime: {
      title: 'Overtime report',
      rows: report.overtimeReport,
      values: (row) => [row.employee?.name, row.date, `${row.overtimeMinutes || 0} overtime minutes`, `${row.workingHoursMinutes || 0} working minutes`],
    },
  };
  const definition = definitions[normalizedKind];
  const lines = normalizedKind === 'summary'
    ? ['GEN VYRO - HR REPORT', '', ...Object.entries(report.summary || {}).map(([label, value]) => `${label}: ${value}`)]
    : [
      `GEN VYRO - ${definition.title.toUpperCase()}`,
      '',
      ...(definition.rows.length
        ? definition.rows.flatMap((row) => [definition.values(row).filter((value) => value !== undefined && value !== null && value !== '').join(' | '), ''])
        : ['No records found for this report.']),
    ];
  const pageLines = [];
  for (let index = 0; index < lines.length; index += 45) pageLines.push(lines.slice(index, index + 45));
  if (!pageLines.length) pageLines.push(['GEN VYRO - HR REPORT', 'No records found for this report.']);

  const objects = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const pageIds = pageLines.map((_, index) => 4 + index * 2);
  const contentIds = pageIds.map((id) => id + 1);
  objects[catalogId] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[pagesId] = `<< /Type /Pages /Count ${pageLines.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pageLines.forEach((page, index) => {
    const commands = ['BT', '/F1 9 Tf', '40 760 Td'];
    page.forEach((line, lineIndex) => {
      if (lineIndex) commands.push('0 -16 Td');
      commands.push(`(${pdfText(String(line).slice(0, 110))}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects[pageIds[index]] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
    objects[contentIds[index]] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  });
  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(document, 'ascii');
    document += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, 'ascii');
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    document += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, 'ascii');
}

module.exports = { buildSalarySlipPdf, buildReportPdf };
