const officegen = require('officegen');
const axios = require('axios');
const { Readable } = require('stream');

// 生成Word文档
function generateWord(content) {
  const docx = officegen('docx');
  const stream = new Readable();
  stream._read = () => {};

  const sections = JSON.parse(content);
  sections.forEach(section => {
    const p = docx.createP();
    p.addText(section.title, { font_size: 16, bold: true });
    p.addText('\n' + section.content, { font_size: 12 });
    p.addLineBreak();
  });

  docx.generate(stream, { type: 'nodebuffer' });
  return stream;
}

// 生成Excel文档
function generateExcel(content) {
  const xlsx = officegen('xlsx');
  const stream = new Readable();
  stream._read = () => {};

  const excelData = JSON.parse(content);
  const sheet = xlsx.makeNewSheet(excelData.sheetName || 'Sheet1');
  
  // 写入表头
  excelData.headers.forEach((header, col) => {
    sheet.data[0][col] = header;
  });
  // 写入数据行
  excelData.rows.forEach((row, rowIdx) => {
    row.forEach((cell, col) => {
      sheet.data[rowIdx + 1][col] = cell;
    });
  });

  xlsx.generate(stream, { type: 'nodebuffer' });
  return stream;
}

// 生成PPT（HTML转PDF适配PPT比例）
async function generatePPT(content) {
  const slides = JSON.parse(content);
  let html = '<!DOCTYPE html><html><body>';
  slides.forEach(slide => {
    html += `
      <div style="width: 1280px; height: 720px; margin: 20px auto; padding: 20px; border: 1px solid #ccc;">
        <h1 style="font-size: 36px; text-align: center;">${slide.title}</h1>
        <div style="font-size: 24px; margin-top: 40px;">${slide.content}</div>
      </div>
    `;
  });
  html += '</body></html>';

  const res = await axios.post(
    'https://api.html2pdf.app/v1/generate',
    { html, landscape: true },
    { responseType: 'stream' }
  );
  return res.data;
}

// Netlify Functions入口
exports.handler = async (event) => {
  try {
    const { aiContent, fileType } = JSON.parse(event.body);
    if (!aiContent || !['word', 'excel', 'ppt'].includes(fileType)) {
      return { statusCode: 400, body: JSON.stringify({ error: '参数错误' }) };
    }

    let fileStream;
    switch (fileType) {
      case 'word': fileStream = generateWord(aiContent); break;
      case 'excel': fileStream = generateExcel(aiContent); break;
      case 'ppt': fileStream = await generatePPT(aiContent); break;
    }

    // 流转Base64
    const chunks = [];
    for await (const chunk of fileStream) chunks.push(chunk);
    const base64 = Buffer.concat(chunks).toString('base64');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        fileBase64: base64,
        fileName: `${Date.now()}.${fileType === 'ppt' ? 'pdf' : fileType}`
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
