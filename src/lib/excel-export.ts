import * as XLSX from "xlsx";

export function downloadExcel(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  sheetName: string = "Report"
) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  const colWidths = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const cellLen = String(row[i] || "").length;
      if (cellLen > max) max = cellLen;
    }
    return { wch: Math.min(max + 2, 40) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function safeWorksheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[\\/?*\[\]:]/g, " ").replace(/\s+/g, " ").trim() || "Report").slice(0, 31);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const ending = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - ending.length)}${ending}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function downloadMultiSheetExcel(
  sheets: { name: string; headers: string[]; rows: (string | number)[][] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();
  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const colWidths = sheet.headers.map((h, i) => {
      let max = h.length;
      for (const row of sheet.rows) {
        const cellLen = String(row[i] || "").length;
        if (cellLen > max) max = cellLen;
      }
      return { wch: Math.min(max + 2, 40) };
    });
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, safeWorksheetName(sheet.name, usedSheetNames));
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
