export function downloadCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  titleRow?: string
) {
  const lines: string[] = [];

  if (titleRow) {
    lines.push(titleRow);
    lines.push("");
  }

  lines.push(headers.join(","));
  lines.push(
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(",")
    )
  );

  const csvContent = lines.join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
