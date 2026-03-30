'use client';

import { useState } from 'react';
import { FileDown, FileText, Loader2 } from 'lucide-react';

export default function ExportButtons({ activities, lessonData, generatedLesson, isTimeValid = true }) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);

  const lessonName = lessonData?.lessonName || 'Giáo Án';
  const fileName = `giao-an-${lessonName.replace(/\s+/g, '-').toLowerCase()}`;

  async function handleExportPDF() {
    if (!activities?.length) return;
    setExportingPdf(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      const resultEl = document.getElementById('lesson-result');
      if (!resultEl) return;

      // Hide input borders for clean PDF
      const inputs = resultEl.querySelectorAll('textarea, input, select');
      inputs.forEach((el) => {
        el.dataset.origBorder = el.style.border;
        el.dataset.origBg = el.style.background;
        el.style.border = 'none';
        el.style.background = 'transparent';
        el.style.boxShadow = 'none';
      });

      const canvas = await html2canvas(resultEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false,
      });

      // Restore
      inputs.forEach((el) => {
        el.style.border = el.dataset.origBorder || '';
        el.style.background = el.dataset.origBg || '';
        el.style.boxShadow = '';
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - 2 * margin;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      let remainingHeight = imgHeight;
      let firstPage = true;

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(pageHeight - 2 * margin, remainingHeight);
        const srcY = ((imgHeight - remainingHeight) / imgHeight) * canvas.height;
        const srcH = (sliceHeight / imgHeight) * canvas.height;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = srcH;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        if (!firstPage) pdf.addPage();
        pdf.addImage(tempCanvas.toDataURL('image/png'), 'PNG', margin, margin, usableWidth, sliceHeight);
        remainingHeight -= sliceHeight;
        firstPage = false;
      }

      pdf.save(`${fileName}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Có lỗi khi xuất PDF. Vui lòng thử lại.');
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportWord() {
    if (!activities?.length) return;
    setExportingWord(true);
    try {
      const {
        Document, Packer, Paragraph, Table, TableRow, TableCell,
        TextRun, AlignmentType, WidthType, BorderStyle
      } = await import('docx');

      const defaultFont = "Times New Roman";
      const size13 = 26; // 13pt

      const noBorders = {
        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
      };

      function createHeaderCell(text, widthPercent) {
        return new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: size13, font: defaultFont })], alignment: AlignmentType.CENTER })],
          width: { size: widthPercent, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        });
      }

      function createCell(text, widthPercent) {
        return new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: text || '', size: size13, font: defaultFont })] })],
          width: { size: widthPercent, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        });
      }

      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('TT', 5),
          createHeaderCell('Nội dung', 30),
          createHeaderCell('Hoạt động GV', 25),
          createHeaderCell('Hoạt động HS', 25),
          createHeaderCell('Thời gian', 15),
        ],
      });

      const dataRows = activities.map((act, idx) =>
        new TableRow({
          children: [
            createCell((idx + 1).toString(), 5),
            createCell(act.detailedContent || '', 30),
            createCell(act.teacherActions || '', 25),
            createCell(act.studentActions || '', 25),
            createCell(act.time || '', 15),
          ],
        })
      );

      const info = generatedLesson?.lessonInfo || {};

      const doc = new Document({
        styles: {
          default: {
            document: {
              run: { font: defaultFont, size: size13 },
            },
          },
        },
        sections: [{
          properties: {
            page: { margin: { top: 1100, right: 1100, bottom: 1100, left: 1100 } }
          },
          children: [
            // Header
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: noBorders,
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Trường Cao đẳng Bách khoa Nam Sài Gòn", bold: true, size: size13, font: defaultFont })], alignment: AlignmentType.LEFT })],
                      width: { size: 60, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Mẫu: Phụ lục 10", bold: true, size: size13, font: defaultFont })], alignment: AlignmentType.RIGHT })],
                      width: { size: 40, type: WidthType.PERCENTAGE },
                    }),
                  ]
                })
              ]
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            
            // Section 1
            new Paragraph({ children: [new TextRun({ text: `Giáo án số: ${info.lessonNumber || ''}`, size: size13, font: defaultFont })] }),
            new Paragraph({ children: [new TextRun({ text: `Tên chương: ${info.chapterName || ''}`, size: size13, font: defaultFont })] }),
            new Paragraph({ children: [new TextRun({ text: `Tên bài: ${info.lessonName || lessonData?.lessonName || ''}`, size: size13, font: defaultFont })] }),
            new Paragraph({ children: [new TextRun({ text: `Ngày thực hiện: ${info.executionDate || ''}`, size: size13, font: defaultFont })] }),
            new Paragraph({ text: "" }),
            
            // Section 2
            new Paragraph({ children: [new TextRun({ text: "1. Mục tiêu bài học:", bold: true, size: size13, font: defaultFont })] }),
            new Paragraph({ children: [new TextRun({ text: generatedLesson?.objectives || '', size: size13, font: defaultFont })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "2. Đồ dùng dạy học:", bold: true, size: size13, font: defaultFont })] }),
            new Paragraph({ children: [new TextRun({ text: generatedLesson?.materials || '', size: size13, font: defaultFont })] }),
            new Paragraph({ text: "" }),
            
            // Section 3
            new Paragraph({ children: [new TextRun({ text: "3. Các bước lên lớp:", bold: true, size: size13, font: defaultFont })] }),
            new Paragraph({ text: "" }),
            new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
            
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            
            // Signatures
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: noBorders,
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "TRƯỞNG KHOA", bold: true, size: size13, font: defaultFont })], alignment: AlignmentType.CENTER })],
                      width: { size: 50, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "GIẢNG VIÊN", bold: true, size: size13, font: defaultFont })], alignment: AlignmentType.CENTER })],
                      width: { size: 50, type: WidthType.PERCENTAGE },
                    }),
                  ]
                })
              ]
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Word error:', err);
      alert('Có lỗi khi xuất Word. Vui lòng thử lại.');
    } finally {
      setExportingWord(false);
    }
  }

  if (!activities?.length) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-6 pb-2">
      {/* PDF – M3 tonal pill button */}
      <button
        onClick={handleExportPDF}
        disabled={exportingPdf || !isTimeValid}
        className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-4 rounded-full shadow-md shadow-rose-200 hover:shadow-lg hover:-translate-y-0.5 disabled:shadow-none disabled:transform-none transition-all text-sm"
      >
        {exportingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
        {exportingPdf ? 'Đang xuất PDF...' : 'Xuất file PDF'}
      </button>

      {/* Word – M3 tonal pill button */}
      <button
        onClick={handleExportWord}
        disabled={exportingWord || !isTimeValid}
        className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-4 rounded-full shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 disabled:shadow-none disabled:transform-none transition-all text-sm"
      >
        {exportingWord ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
        {exportingWord ? 'Đang xuất Word...' : 'Xuất file Word Phụ lục 10'}
      </button>
    </div>
  );
}
