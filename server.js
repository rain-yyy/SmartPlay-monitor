const express = require('express');
const { runScraper } = require('./scraper');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/scrape', async (_req, res) => {
  try {
    const data = await runScraper();
    res.json({ success: true, data });
  } catch (err) {
    console.error('scrape error', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'scrape failed'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HTTP service listening on ${PORT}`);
});

