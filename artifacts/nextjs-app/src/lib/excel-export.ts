export type SpreadsheetCell = string | number | boolean | Date | null | undefined;

interface SpreadsheetSheet {
  name: string;
  rows: SpreadsheetCell[][];
}

const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function safeCell(value: SpreadsheetCell): SpreadsheetCell {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function safeSheetName(name: string) {
  return name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Report';
}

export async function downloadExcelFile(filename: string, sheets: SpreadsheetSheet[]) {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(safeSheetName(sheet.name));
    worksheet.addRows(sheet.rows.map((row) => row.map(safeCell)));
    worksheet.columns.forEach((column) => {
      const lengths = column.values
        ?.slice(1)
        .map((value) => String(value ?? '').length) ?? [];
      column.width = Math.min(50, Math.max(12, ...lengths) + 2);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}