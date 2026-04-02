import { NextResponse } from 'next/server';
import htmlToDocx from 'html-to-docx';

export const maxDuration = 300;

export async function POST(req) {
  try {
    const { html, title } = await req.json();

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; table-layout: fixed; }
            th, td { border: 1pt solid black; padding: 5pt; vertical-align: top; word-wrap: break-word; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div style="font-family: 'Times New Roman', serif;">
            ${html}
          </div>
        </body>
      </html>
    `;

    try {
      const docx = await htmlToDocx(fullHtml, null, {
        orientation: 'portrait',
        margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch in twips
      });

      return new NextResponse(docx, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename=GiaoAn_${encodeURIComponent(title.replace(/\s+/g, '_'))}.docx`,
        },
      });
    } catch (docxErr) {
      console.error("html-to-docx failure:", docxErr);
      throw new Error(`Lỗi chuyển đổi HTML sang DOCX: ${docxErr.message}`);
    }
  } catch (err) {
    console.error("Export Route Error:", err);
    return NextResponse.json({ 
      error: "Không thể xuất file Word.",
      details: err.message 
    }, { status: 500 });
  }
}
