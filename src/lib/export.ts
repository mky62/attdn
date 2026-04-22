import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExportRow, ExportSummaryRow } from '../types';
import { saveBinary, saveText } from './files';

// ── CSV Export ──────────────────────────────────────────────────────────

function buildAttendanceCsv(rows: ExportRow[]): string {
  return Papa.unparse(rows, {
    columns: ['roll_number', 'student_name', 'date', 'status'],
    header: true,
  });
}

function buildSummaryCsv(rows: ExportSummaryRow[]): string {
  return Papa.unparse(rows, {
    columns: ['roll_number', 'student_name', 'total_sessions', 'present_count', 'percentage'],
    header: true,
  });
}

// ── Excel Export ─────────────────────────────────────────────────────────

function buildAttendanceExcel(rows: ExportRow[]): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['roll_number', 'student_name', 'date', 'status'],
  });
  ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

function buildSummaryExcel(rows: ExportSummaryRow[]): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['roll_number', 'student_name', 'total_sessions', 'present_count', 'percentage'],
  });
  ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

// ── PDF Export ──────────────────────────────────────────────────────────

function buildAttendancePdf(rows: ExportRow[], className: string): ArrayBuffer {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Attendance Report - ${className}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [['Roll No', 'Student Name', 'Date', 'Status']],
    body: rows.map((r) => [r.roll_number, r.student_name, r.date, r.status]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  return doc.output('arraybuffer');
}

function buildSummaryPdf(rows: ExportSummaryRow[], className: string): ArrayBuffer {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Attendance Summary - ${className}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [['Roll No', 'Student Name', 'Total Sessions', 'Present', 'Percentage']],
    body: rows.map((r) => [
      r.roll_number,
      r.student_name,
      r.total_sessions,
      r.present_count,
      `${r.percentage}%`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  return doc.output('arraybuffer');
}

// ── Save Helpers ────────────────────────────────────────────────────────

async function saveFile(
  content: string | ArrayBuffer,
  defaultName: string,
  mimeType: string,
): Promise<boolean> {
  if (typeof content === 'string') {
    return saveText(content, defaultName, mimeType);
  }

  return saveBinary(content, defaultName, mimeType);
}

// ── Public API ──────────────────────────────────────────────────────────

export async function exportAttendanceCsv(rows: ExportRow[], className: string): Promise<boolean> {
  const csv = buildAttendanceCsv(rows);
  return saveFile(csv, `${className}_attendance.csv`, 'text/csv;charset=utf-8');
}

export async function exportSummaryCsv(rows: ExportSummaryRow[], className: string): Promise<boolean> {
  const csv = buildSummaryCsv(rows);
  return saveFile(csv, `${className}_summary.csv`, 'text/csv;charset=utf-8');
}

export async function exportAttendanceExcel(rows: ExportRow[], className: string): Promise<boolean> {
  const buffer = buildAttendanceExcel(rows);
  return saveFile(
    buffer,
    `${className}_attendance.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

export async function exportSummaryExcel(rows: ExportSummaryRow[], className: string): Promise<boolean> {
  const buffer = buildSummaryExcel(rows);
  return saveFile(
    buffer,
    `${className}_summary.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

export async function exportAttendancePdf(rows: ExportRow[], className: string): Promise<boolean> {
  const buffer = buildAttendancePdf(rows, className);
  return saveFile(buffer, `${className}_attendance.pdf`, 'application/pdf');
}

export async function exportSummaryPdf(rows: ExportSummaryRow[], className: string): Promise<boolean> {
  const buffer = buildSummaryPdf(rows, className);
  return saveFile(buffer, `${className}_summary.pdf`, 'application/pdf');
}
