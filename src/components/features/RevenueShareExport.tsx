"use client";

import { useState, useEffect } from "react";
import { Download, Percent } from "lucide-react";
import { FileText } from "lucide-react";
import { downloadCSV } from "@/lib/csv-export";
import { downloadExcel } from "@/lib/excel-export";
import { generateMonthlyPDFReport, type PDFReportOptions } from "@/lib/pdf-report";

interface RevenueShareExportProps {
  baseHeaders: string[];
  baseRows: (string | number)[][];
  filename: string;
  csvTitle?: string;
  sheetName?: string;
  totalRevenue: number;
  exchangeRate: number;
  pdfOptions?: Omit<PDFReportOptions, "revenueSharePercent">;
}

export default function RevenueShareExport({
  baseHeaders,
  baseRows,
  filename,
  csvTitle,
  sheetName,
  totalRevenue,
  exchangeRate,
  pdfOptions,
}: RevenueShareExportProps) {
  const [dealPercent, setDealPercent] = useState(0);
  const [showDealInput, setShowDealInput] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cms_deal_percent");
    if (saved) setDealPercent(Number(saved));
  }, []);

  const saveDealPercent = (val: number) => {
    setDealPercent(val);
    localStorage.setItem("cms_deal_percent", String(val));
  };

  const getExportData = () => {
    if (dealPercent <= 0) {
      return { headers: baseHeaders, rows: baseRows };
    }
    const shareHeaders = [...baseHeaders, "Deal %", "Net Payment ($)", "Net Payment (INR)"];
    const shareRows = baseRows.map((row) => {
      const revIdx = baseHeaders.findIndex((h) => h.toLowerCase().includes("revenue ($)") || h.toLowerCase().includes("est. revenue"));
      const revVal = revIdx >= 0 ? Number(row[revIdx]) || 0 : 0;
      const netPayment = revVal * ((100 - dealPercent) / 100);
      return [...row, `${dealPercent}%`, netPayment.toFixed(2), Math.round(netPayment * exchangeRate).toString()];
    });
    return { headers: shareHeaders, rows: shareRows };
  };

  const getTotalRow = () => {
    if (dealPercent <= 0) return null;
    const netTotal = totalRevenue * ((100 - dealPercent) / 100);
    return {
      totalRevenue,
      netPayment: netTotal,
      netPaymentINR: Math.round(netTotal * exchangeRate),
      sharePercent: dealPercent,
    };
  };

  const handleCSV = () => {
    const { headers, rows } = getExportData();
    const totals = getTotalRow();
    const finalRows = [...rows];
    if (totals) {
      const summaryRow = new Array(headers.length).fill("") as (string | number)[];
      summaryRow[0] = "TOTAL";
      const revIdx = headers.findIndex((h) => h.toLowerCase().includes("revenue ($)") || h.toLowerCase().includes("est. revenue"));
      if (revIdx >= 0) summaryRow[revIdx] = totals.totalRevenue.toFixed(2);
      summaryRow[headers.length - 3] = `${totals.sharePercent}%`;
      summaryRow[headers.length - 2] = totals.netPayment.toFixed(2);
      summaryRow[headers.length - 1] = totals.netPaymentINR.toString();
      finalRows.push(summaryRow);
    }
    downloadCSV(headers, finalRows, filename, csvTitle);
  };

  const handleExcel = () => {
    const { headers, rows } = getExportData();
    const totals = getTotalRow();
    const finalRows = [...rows];
    if (totals) {
      const summaryRow = new Array(headers.length).fill("") as (string | number)[];
      summaryRow[0] = "TOTAL";
      const revIdx = headers.findIndex((h) => h.toLowerCase().includes("revenue ($)") || h.toLowerCase().includes("est. revenue"));
      if (revIdx >= 0) summaryRow[revIdx] = totals.totalRevenue.toFixed(2);
      summaryRow[headers.length - 3] = `${totals.sharePercent}%`;
      summaryRow[headers.length - 2] = totals.netPayment.toFixed(2);
      summaryRow[headers.length - 1] = totals.netPaymentINR;
      finalRows.push(summaryRow);
    }
    downloadExcel(headers, finalRows, filename, sheetName || "Report");
  };

  const handlePDF = () => {
    if (!pdfOptions) return;
    generateMonthlyPDFReport({
      ...pdfOptions,
      revenueSharePercent: dealPercent > 0 ? dealPercent : undefined,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setShowDealInput(!showDealInput)}
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-2 border rounded-lg transition-colors ${
            dealPercent > 0
              ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
              : "border-border hover:bg-slate-50"
          }`}
          title="Set deal % for reports"
        >
          <Percent className="w-3.5 h-3.5" />
          {dealPercent > 0 ? `${dealPercent}%` : "Deal"}
        </button>
        {showDealInput && (
          <div className="absolute top-full right-0 mt-1 bg-white border border-border rounded-lg shadow-lg p-3 z-50 w-56">
            <label className="block text-xs font-medium text-foreground mb-1.5">Deal / Share %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={dealPercent}
              onChange={(e) => saveDealPercent(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. 25"
            />
            <p className="text-[10px] text-muted mt-1.5">
              {dealPercent > 0
                ? `Reports will show: Total - ${dealPercent}% = ${100 - dealPercent}% net payment`
                : "Set to 0 to disable share calculation"}
            </p>
            <button
              onClick={() => setShowDealInput(false)}
              className="mt-2 w-full text-xs py-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 font-medium"
            >
              Done
            </button>
          </div>
        )}
      </div>
      <button
        onClick={handleCSV}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-border rounded-lg hover:bg-slate-50"
      >
        <Download className="w-3.5 h-3.5" />
        CSV
      </button>
      <button
        onClick={handleExcel}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
      >
        <Download className="w-3.5 h-3.5" />
        Excel
      </button>
      {pdfOptions && (
        <button
          onClick={handlePDF}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100"
        >
          <FileText className="w-3.5 h-3.5" />
          PDF
        </button>
      )}
    </div>
  );
}
