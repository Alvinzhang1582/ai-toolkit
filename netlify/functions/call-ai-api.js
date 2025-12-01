const axios = require('axios');
const crypto = require('crypto');

// 调用通义千问API（失败时自动切换文心一言）
async function callQianwenAPI(prompt, systemPrompt) {
  const accessKeyId = process.env.QIANWEN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.QIANWEN_ACCESS_KEY_SECRET;
  const host = 'qianwen-api.aliyun.com';
  const path = '/v1/chat/completions';
  const method = 'POST';
  const timestamp = new Date().toISOString();
  const nonce = Math.random().toString(36).substr(2, 10);

  // 构建请求体
  const requestBody = JSON.stringify({
    model: 'qwen-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3
  });

  // 生成阿里云API签名
  const stringToSign = `${method}\n${host}\n${path}\n${timestamp}\n${nonce}\n${requestBody}`;
  const signature = crypto.createHmac('sha256', accessKeySecret)
    .update(stringToSign, 'utf8')
    .digest('base64');

  try {
    const response = await axios({
      url: `https://${host}${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-AppId': accessKeyId,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature
      },
      data: requestBody
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('通义千问调用失败，切换文心一言', error.message);
    return callWenxinAPI(prompt, systemPrompt);
  }
}

// 调用文心一言API（备用）
async function callWenxinAPI(prompt, systemPrompt) {
  const apiKey = process.env.WENXIN_API_KEY;
  const secretKey = process.env.WENXIN_SECRET_KEY;

  // 获取百度API令牌
  const tokenRes = await axios.get(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`);
  const accessToken = tokenRes.data.access_token;

  // 发送生成请求
  const res = await axios.post(
    `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${accessToken}`,
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return res.data.result;
}

// Netlify Functions入口
exports.handler = async (event) => {
  try {
    const { prompt, systemPrompt } = JSON.parse(event.body);
    if (!prompt || !systemPrompt) {
      return { statusCode: 400, body: JSON.stringify({ error: '缺少prompt或systemPrompt' }) };
    }

    const aiContent = await callQianwenAPI(prompt, systemPrompt);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, aiContent })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
