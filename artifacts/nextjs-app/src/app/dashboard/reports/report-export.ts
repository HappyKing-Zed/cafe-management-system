import { downloadExcelFile } from '@/lib/excel-export';

type ExportFormat = 'pdf' | 'excel';
type ExportRange = { start: string; end: string };

export interface ReportExportData {
  title: string;
  file: string;
  head: string[];
  rows: any[][];
  records?: unknown[];
}

const SENSITIVE_EXPORT_FIELD =
  /(^|[._])(password|passwordhash|passcode|pin|secret|token|accesstoken|refreshtoken|apikey|credential|session|salt|hash)([._]|$)/i;

function flattenExportRecord(
  value: unknown,
  prefix = '',
  output: Record<string, string | number> = {},
) {
  if (value === null || value === undefined) {
    if (prefix) output[prefix] = '—';
    return output;
  }
  if (Array.isArray(value)) {
    if (value.length === 0 && prefix) output[prefix] = '—';
    value.forEach((entry, index) =>
      flattenExportRecord(entry, `${prefix}[${index + 1}]`, output),
    );
    return output;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) output[prefix] = '—';
    entries.forEach(([key, entry]) => {
      const field = prefix ? `${prefix}.${key}` : key;
      if (!SENSITIVE_EXPORT_FIELD.test(field)) {
        flattenExportRecord(entry, field, output);
      }
    });
    return output;
  }
  output[prefix || 'value'] =
    typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value as string | number);
  return output;
}

export function withCompleteDetails(data: ReportExportData): ReportExportData {
  const flattened = (data.records || []).map((record) => flattenExportRecord(record));
  const detailFields = Array.from(
    new Set(flattened.flatMap((record) => Object.keys(record))),
  );
  const rowCount = Math.max(data.rows.length, flattened.length);

  return {
    ...data,
    head: [...data.head, ...detailFields.map((field) => `Detail — ${field}`)],
    rows: Array.from({ length: rowCount }, (_, index) => [
      ...(data.rows[index] || data.head.map(() => '')),
      ...detailFields.map((field) => flattened[index]?.[field] ?? '—'),
    ]),
  };
}

async function exportPdf(data: ReportExportData) {
  const { default: jsPDF } = await import('jspdf');
  const autoTableModule: any = await import('jspdf-autotable');
  const autoTable = autoTableModule.autoTable ?? autoTableModule.default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const columnsPerPage = 8;
  const columnGroups = Array.from(
    { length: Math.max(1, Math.ceil(data.head.length / columnsPerPage)) },
    (_, index) => ({
      start: index * columnsPerPage,
      end: Math.min((index + 1) * columnsPerPage, data.head.length),
    }),
  );

  columnGroups.forEach((group, index) => {
    if (index > 0) doc.addPage();
    doc.setFontSize(14);
    doc.text(`Jima · CARAVAN Lounge — ${data.title}`, 14, 16);
    doc.setFontSize(9);
    doc.text(
      `Generated ${new Date().toLocaleString()} · Columns ${group.start + 1}–${group.end} of ${data.head.length}`,
      14,
      22,
    );
    autoTable(doc, {
      head: [data.head.slice(group.start, group.end)],
      body: data.rows.map((row) =>
        row.slice(group.start, group.end).map((value) => String(value ?? '—')),
      ),
      startY: 27,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 250, 248] },
      margin: { left: 10, right: 10 },
    });
  });
  doc.save(`${data.file}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function exportExcel(data: ReportExportData) {
  await downloadExcelFile(
    `${data.file}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    [{ name: data.title, rows: [[data.title], data.head, ...data.rows] }],
  );
}

export async function exportReport(format: ExportFormat, data: ReportExportData) {
  if (format === 'pdf') {
    await exportPdf(data);
  } else {
    await exportExcel(data);
  }
}

function serviceFilters(range: ExportRange, waiterName?: string) {
  return {
    periodStart: range.start,
    periodEnd: range.end,
    waiter: waiterName || 'All waiters',
  };
}

function buildSummaryExportData(summary: any, range: ExportRange, waiterName?: string) {
  const filters = serviceFilters(range, waiterName);
  const records: unknown[] = [
    { section: 'Totals', filters, totals: summary?.totals || {} },
    ...(summary?.byWaiter || []).map((waiter: any) => ({
      section: 'Waiter',
      filters,
      waiter,
    })),
    ...(summary?.byTable || []).flatMap((table: any) => {
      const items = table.itemDetail?.length ? table.itemDetail : [null];
      return items.map((item: any) => ({
        section: 'Table and item',
        filters,
        table: { ...table, itemDetail: undefined },
        item,
      }));
    }),
  ];

  return withCompleteDetails({
    title: 'Service Summary — Complete Details',
    file: `service-summary-${range.start.slice(0, 10)}-to-${range.end.slice(0, 10)}`,
    head: ['Section'],
    rows: records.map((record: any) => [record.section]),
    records,
  });
}

function buildReportsExportData(
  submissions: any[],
  range: ExportRange,
  waiterName?: string,
) {
  const filters = serviceFilters(range, waiterName);
  const records = submissions.flatMap((submission: any) => {
    const details = submission.detail?.length ? submission.detail : [null];
    return details.flatMap((detail: any) => {
      const items = detail?.items?.length ? detail.items : [null];
      return items.map((item: any) => ({
        filters,
        submission: { ...submission, detail: undefined },
        orderDetail: detail ? { ...detail, items: undefined } : null,
        item,
      }));
    });
  });

  return withCompleteDetails({
    title: 'Daily Service Reports — Complete Details',
    file: `service-reports-${range.start.slice(0, 10)}-to-${range.end.slice(0, 10)}`,
    head: ['Report', 'Service Date', 'Status'],
    rows: records.map((record: any) => [
      record.submission?.id ? `#${record.submission.id}` : '—',
      record.submission?.serviceDate || '—',
      record.submission?.status || '—',
    ]),
    records,
  });
}

export function exportServiceSummary(
  format: ExportFormat,
  summary: any,
  range: ExportRange,
  waiterName?: string,
) {
  return exportReport(format, buildSummaryExportData(summary, range, waiterName));
}

export function exportServiceReports(
  format: ExportFormat,
  submissions: any[],
  range: ExportRange,
  waiterName?: string,
) {
  return exportReport(format, buildReportsExportData(submissions, range, waiterName));
}