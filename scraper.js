const { chromium } = require('playwright-chromium');
const { generateUrl } = require('./url_generator');

// 預定義的指紋配置
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
];

const LOCALES = ['zh-HK', 'zh-CN', 'en-US', 'en-GB'];
const TIMEZONES = ['Asia/Hong_Kong', 'Asia/Shanghai', 'America/New_York', 'Europe/London'];

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 入口函式：每次被 API 觸發時啟動 Chromium，並在完成後關閉。
 * @returns {Promise<Object>} 爬取結果
 */
async function runScraper(retries = 2) {
  let browser;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      browser = await chromium.launch({ 
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled', // 隱藏自動化特徵
        ]
      });

      // 每次請求使用隨機配置
      const context = await browser.newContext({
        userAgent: getRandomItem(USER_AGENTS),
        locale: getRandomItem(LOCALES),
        timezoneId: getRandomItem(TIMEZONES),
        viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 720 + Math.floor(Math.random() * 100) },
        deviceScaleFactor: Math.random() > 0.5 ? 1 : 2,
      });

      const page = await context.newPage();
      
      // 額外隱藏 webdriver 特徵
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const urlToVisit = generateUrl();
      console.log(`[Attempt ${attempt + 1}] Visiting: ${urlToVisit}`);

      // 增加超時時間，並使用 networkidle 確保內容載入完成
      await page.goto(urlToVisit, {
        waitUntil: 'networkidle',
        timeout: 45_000
      });

      // 額外等待 1-3 秒，模擬真人行為，確保所有腳本執行完畢並設定 Cookie
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const cookies = await context.cookies(urlToVisit);
      
      // 簡單校驗：如果沒拿到 cookie 可能被封或加載失敗
      if (cookies.length === 0) {
        throw new Error('No cookies obtained');
      }

      await browser.close();
      return { url: urlToVisit, cookies, attempt: attempt + 1 };

    } catch (err) {
      console.error(`Attempt ${attempt + 1} failed:`, err.message);
      if (browser) await browser.close();
      attempt++;
      if (attempt > retries) throw err;
      // 重試前稍微等待
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

module.exports = { runScraper };

