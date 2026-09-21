const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5173;
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function getApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const match = fs.readFileSync(envPath, 'utf8').match(/^GEMINI_API_KEY\s*=\s*(.*)$/m);
      if (match && match[1]) return match[1].trim().replace(/^['"]|['"]$/g, '');
    } catch (e) {}
  }
  const securePath = '/Users/aman/Library/Application Support/ghosthud-ai/secure_config.json';
  if (fs.existsSync(securePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(securePath, 'utf8'));
      if (data && data.apiKey) return data.apiKey.trim();
    } catch (e) {}
  }
  return '';
}

const https = require('https');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // API Route: check if server has key configured
  if (reqPath === '/api/key' && req.method === 'GET') {
    const key = getApiKey();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hasKey: !!key }));
    return;
  }

  // API Route: secure backend Gemini proxy for web users
  if (reqPath === '/api/gemini' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const key = getApiKey();
      if (!key) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, isDemo: true, error: 'NO_API_KEY' }));
        return;
      }

      let payload = {};
      try { payload = JSON.parse(body); } catch (e) {}

      let model = payload.model || 'gemini-3.6-flash';
      if (!model || model.includes('2.5') || model.includes('1.5')) model = 'gemini-3.6-flash';

      const systemInstruction = 
        "You are Koko, a friendly, brilliantly smart anime study companion sitting on the user's screen while they watch a lecture or study. " +
        "Personality: Warm, witty, concise, human, and encouraging. Never sound like a robotic AI manual. " +
        "Rules: " +
        "1. Explain lecture concepts simply and intuitively using relatable metaphors. " +
        "2. If an equation or math is shown, break down every variable with LaTeX math notation ($...$ and $$...$$). " +
        "3. Be punchy and keep answers quick to read so the user doesn't miss lecture progress. " +
        "4. Use clear bullet points and bold keywords.";

      const parts = [];
      if (payload.attachedImage && payload.attachedImage.base64) {
        parts.push({
          inlineData: {
            mimeType: payload.attachedImage.mimeType || 'image/png',
            data: payload.attachedImage.base64
          }
        });
      }
      parts.push({ text: payload.promptText || 'Hello Koko!' });

      const requestData = JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 1000 }
      });

      const callGemini = (m) => new Promise((resolve) => {
        const proxyReq = https.request({
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
          },
          timeout: 20000
        }, (proxyRes) => {
          let data = '';
          proxyRes.on('data', c => data += c);
          proxyRes.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
                const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text || "Couldn't formulate a reply!";
                resolve({ success: true, reply, statusCode: proxyRes.statusCode });
              } else {
                resolve({ success: false, error: json?.error?.message || `API error ${proxyRes.statusCode}`, statusCode: proxyRes.statusCode });
              }
            } catch (e) {
              resolve({ success: false, error: 'JSON parse error', statusCode: proxyRes.statusCode });
            }
          });
        });
        proxyReq.on('error', err => resolve({ success: false, error: err.message, statusCode: 0 }));
        proxyReq.write(requestData);
        proxyReq.end();
      });

      let resObj = await callGemini(model);
      if (!resObj.success && (resObj.statusCode === 503 || resObj.statusCode === 404)) {
        resObj = await callGemini('gemini-3.5-flash');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resObj));
    });
    return;
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  let filePath = path.join(__dirname, 'src', reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 GhostHUD AI Web Server is active!`);
  console.log(`🌐 Open in Chrome or Brave: http://localhost:${PORT}`);
  console.log(`📌 Click the 'Pop Out' PiP button in Chrome/Brave for Always-On-Top floating window!`);
  console.log(`======================================================\n`);
});
