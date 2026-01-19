const express = require('express');
const { runScraper } = require('./scraper');

const app = express();
app.use(express.json({ limit: '1mb' }));

// 簡單的內存緩存
let cachedCookieData = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 緩存 1 分鐘

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/scrape', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const forceRefresh = req.query.refresh === 'true'; // 支持強制刷新

  const now = Date.now();
  if (!forceRefresh && cachedCookieData && (now - lastFetchTime < CACHE_TTL)) {
    console.log(`[${requestId}] Returning cached cookies...`);
    return res.json({ success: true, data: cachedCookieData, cached: true });
  }

  console.log(`[${requestId}] Starting fresh scrape request...`);
  try {
    const data = await runScraper();
    cachedCookieData = data;
    lastFetchTime = now;
    console.log(`[${requestId}] Scrape successful, cache updated`);
    res.json({ success: true, data });
  } catch (err) {
    // ... 錯誤處理保持不變
    console.error(`[${requestId}] Scrape error:`, err);
    res.status(500).json({
      success: false,
      error: err?.message || 'scrape failed',
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HTTP service listening on ${PORT}`);
});

