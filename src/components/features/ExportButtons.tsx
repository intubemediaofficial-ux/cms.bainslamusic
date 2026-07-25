"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { downloadExcel } from "@/lib/excel-export";

interface ExportButtonsProps {
  headers: string[];
  rows: (string | number)[][];
  filename: string;
  titleRow?: string;
  sheetName?: string;
}

export default function ExportButtons({ headers, rows, filename, titleRow, sheetName }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => downloadCSV(headers, rows, filename, titleRow)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-slate-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        CSV
      </button>
      <button
        onClick={() => downloadExcel(headers, rows, `${filename}`, sheetName || "Report")}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Excel
      </button>
    </div>
  );
}
