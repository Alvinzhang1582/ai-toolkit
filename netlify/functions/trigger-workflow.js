const axios = require('axios');

// 构建AI提示词（适配文档生成逻辑）
function buildPrompt(material, requirement) {
  return `
    基于以下素材和需求，生成${requirement.includes('Excel') ? 'Excel表格' : requirement.includes('PPT') ? 'PPT每页结构' : 'Word章节'}的JSON格式内容：
    1. 素材：${material}
    2. 需求：${requirement}
    3. 格式要求：
       - Word：返回{"sections":[{"title":"标题","content":"内容"}]}
       - Excel：返回{"sheetName":"表名","headers":["表头1"],"rows":[["数据1"]]}
       - PPT：返回{"slides":[{"title":"页标题","content":"页内容"}]}
  `;
}

// 构建AI系统提示词
function buildSystemPrompt(fileType) {
  switch (fileType) {
    case 'word': return '你是专业文档师，按要求生成Word章节的JSON结构，内容贴合需求。';
    case 'excel': return '你是Excel专家，按要求生成表格的JSON结构，包含表头和数据。';
    case 'ppt': return '你是PPT设计师，按要求生成每页的JSON结构，适配场景风格。';
  }
}

// Netlify Functions入口
exports.handler = async (event) => {
  try {
    const { material, requirement, fileType } = JSON.parse(event.body);
    if (!material || !requirement || !fileType) {
      return { statusCode: 400, body: JSON.stringify({ error: '缺少必要参数' }) };
    }

    // 步骤1：调用AI接口生成内容
    const netlifyUrl = process.env.URL;
    const aiRes = await axios.post(
      `${netlifyUrl}/.netlify/functions/call-ai-api`,
      {
        prompt: buildPrompt(material, requirement),
        systemPrompt: buildSystemPrompt(fileType)
      }
    );
    const { aiContent } = aiRes.data;

    // 步骤2：生成目标文件
    const fileRes = await axios.post(
      `${netlifyUrl}/.netlify/functions/generate-file`,
      { aiContent, fileType }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(fileRes.data)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
