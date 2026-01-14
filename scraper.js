const { chromium } = require('playwright');

/**
 * 入口函式：每次被 API 觸發時啟動 Chromium，並在完成後關閉。
 * @param {Object} options
 * @param {string} [options.targetUrl] - 目標網址，未提供時使用範例網址。
 * @returns {Promise<Object>} 爬取結果；目前為佔位資料，方便後續擴展。
 */
async function runScraper({ targetUrl } = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const urlToVisit = targetUrl || 'https://www.smartplay.lcsd.gov.hk/facilities/search-result?keywords=&district=CW,EN,SN,WCH&startDate=2026-01-18&typeCode=FOTP&venueCode=&sportCode=BAGM&typeName=%E8%B6%B3%E7%90%83&frmFilterType=&venueSportCode=&isFree=false';

    await page.goto(urlToVisit, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000
    });

    // 目標：取得該請求過程中最終可用的 Cookie 集合（含服務端設定）。
    // 若需要指定網域，可改為 context.cookies(['https://...'])
    const cookies = await context.cookies(urlToVisit);

    return { url: urlToVisit, cookies };
  } finally {
    // 確保無論成功或錯誤都釋放資源，避免常駐。
    await context.close();
    await browser.close();
  }
}

module.exports = { runScraper };

