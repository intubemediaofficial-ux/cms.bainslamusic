import "server-only";

import ExcelJS from "exceljs";
import { google } from "googleapis";
import { getVendorGoogleSheetConfig } from "@/lib/vendor-google-sheet-config";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

export type VendorExcelExportResult =
  | { status: "not_configured" }
  | { status: "ready"; data: ArrayBuffer };

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function normalizedHeader(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function columnWidthFromPixels(pixels: number): number {
  return Math.max(8, Math.round(pixels / 7));
}

export interface VendorMonthExportChannel {
  channelId: string;
  channelName: string;
  clientName: string;
  networkName: string;
  revenueUsd: number;
  linkedDate: string;
}

export function buildVendorMonthExportValues(
  vendorName: string,
  monthLabel: string,
  channels: VendorMonthExportChannel[]
): unknown[][] {
  const total = channels.reduce((sum, channel) => sum + channel.revenueUsd, 0);
  return [
    [
      "Vendor",
      "Client",
      "Channel",
      "Channel Link",
      "Channel ID",
      "Network",
      `${monthLabel} Revenue USD`,
      "Linked Date",
    ],
    ...channels.map((channel) => [
      vendorName,
      channel.clientName,
      channel.channelName,
      `https://www.youtube.com/channel/${channel.channelId}`,
      channel.channelId,
      channel.networkName,
      Number(channel.revenueUsd.toFixed(2)),
      channel.linkedDate
        ? new Date(`${channel.linkedDate}T00:00:00Z`)
        : "",
    ]),
    [""],
    [""],
    ["TOTAL USD", "", "", "", "", "", Number(total.toFixed(2)), ""],
  ];
}

export async function buildVendorExcelWorkbook(
  sheetTitle: string,
  values: unknown[][]
): Promise<ArrayBuffer> {
  if (values.length === 0) throw new Error("Vendor sheet is empty");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InTubeMedia CMS";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheetTitle, {
    properties: { defaultRowHeight: 30 },
    views: [{ state: "frozen", ySplit: 1 }],
  });

  values.forEach((row) => worksheet.addRow(row));
  const headers = values[0] || [];
  const linkedDateColumn = headers.findIndex((value) => {
    const normalized = normalizedHeader(value);
    return normalized === "linkeddate" || normalized === "linkdate";
  }) + 1;
  let totalRowNumber = worksheet.rowCount;
  let hasTotalRow = false;
  worksheet.eachRow((row) => {
    if (row.getCell(1).value === "TOTAL USD") {
      totalRowNumber = row.number;
      hasTotalRow = true;
    }
  });

  worksheet.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF000000" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });

  const header = worksheet.getRow(1);
  header.height = 31.5;
  header.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  for (let rowNumber = 2; rowNumber < totalRowNumber - 2; rowNumber += 1) {
    const linkCell = worksheet.getRow(rowNumber).getCell(4);
    const url = String(linkCell.value || "").trim();
    if (/^https:\/\//i.test(url)) {
      linkCell.value = { text: url, hyperlink: url };
      linkCell.font = { name: "Arial", size: 10, color: { argb: "FF1155CC" } };
    }
  }

  if (linkedDateColumn > 0) {
    for (let column = 7; column < linkedDateColumn; column += 1) {
      worksheet.getColumn(column).numFmt = "0.00";
      worksheet.getColumn(column).alignment = {
        horizontal: "right",
        vertical: "middle",
        wrapText: true,
      };
    }
    worksheet.getColumn(linkedDateColumn).numFmt = "dd-mmm-yyyy";
    worksheet.getColumn(linkedDateColumn).alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  }

  if (hasTotalRow) {
    worksheet.mergeCells(totalRowNumber, 1, totalRowNumber, 6);
    worksheet.getRow(totalRowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });
  }

  [130, 180, 180, 260, 210, 150].forEach((pixels, index) => {
    worksheet.getColumn(index + 1).width = columnWidthFromPixels(pixels);
  });
  if (linkedDateColumn > 0) {
    for (let column = 7; column < linkedDateColumn; column += 1) {
      worksheet.getColumn(column).width = columnWidthFromPixels(165);
    }
    worksheet.getColumn(linkedDateColumn).width = columnWidthFromPixels(125);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  const data = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(data).set(bytes);
  return data;
}

export async function exportVendorGoogleSheetTab(
  sheetTitle: string,
  scopeUserId?: string
): Promise<VendorExcelExportResult> {
  const credentials = await getVendorGoogleSheetConfig(scopeUserId);
  if (!credentials) return { status: "not_configured" };

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey,
    },
    scopes: [SHEETS_SCOPE],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: credentials.spreadsheetId,
    range: `${quoteSheetName(sheetTitle)}!A:ZZ`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const values = response.data.values || [];
  return {
    status: "ready",
    data: await buildVendorExcelWorkbook(sheetTitle, values),
  };
}
