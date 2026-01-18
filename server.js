const express = require('express');
const { runScraper } = require('./scraper');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/scrape', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Starting scrape request...`);
  try {
    const data = await runScraper();
    console.log(`[${requestId}] Scrape successful`);
    res.json({ success: true, data });
  } catch (err) {
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

