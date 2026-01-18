const { chromium } = require('playwright-chromium');
const { generateUrl } = require('./url_generator');

// 預定義的指紋配置
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

const LOCALES = ['zh-HK', 'zh-CN', 'en-US', 'en-GB'];
const TIMEZONES = ['Asia/Hong_Kong', 'Asia/Shanghai']; // 縮小範圍到本地相關區域

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
      console.log(`[Attempt ${attempt + 1}] Launching browser...`);
      browser = await chromium.launch({ 
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-dev-shm-usage', // 防止内存不足
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ]
      });

      // 增加隨機硬體特徵
      const hardwareConcurrency = getRandomItem([4, 8, 12, 16]);
      const deviceMemory = getRandomItem([4, 8, 16]);

      const context = await browser.newContext({
        userAgent: getRandomItem(USER_AGENTS),
        locale: getRandomItem(LOCALES),
        timezoneId: getRandomItem(TIMEZONES),
        viewport: { 
          width: 1280 + Math.floor(Math.random() * 200), 
          height: 800 + Math.floor(Math.random() * 200) 
        },
        deviceScaleFactor: getRandomItem([1, 1.25, 1.5, 2]),
        hasTouch: Math.random() > 0.5,
      });

      const page = await context.newPage();
      
      // 深度偽裝
      await page.addInitScript(({ concurrency, memory }) => {
        // 隱藏 webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // 偽裝硬體資訊
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => concurrency });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => memory });
        
        // 偽裝 Chrome 插件
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
            { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' },
          ],
        });

        // 偽裝 WebGL 指紋 (簡單版)
        const getParameter = HTMLCanvasElement.prototype.getContext('2d').getParameter;
        HTMLCanvasElement.prototype.getContext = ((orig) => function(type, attributes) {
          if (type === 'webgl' || type === 'experimental-webgl') {
            const context = orig.apply(this, [type, attributes]);
            const origGetParameter = context.getParameter;
            context.getParameter = function(param) {
              if (param === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
              if (param === 37446) return 'Intel(R) Iris(R) Xe Graphics'; // UNMASKED_RENDERER_WEBGL
              return origGetParameter.apply(this, [param]);
            };
            return context;
          }
          return orig.apply(this, [type, attributes]);
        })(HTMLCanvasElement.prototype.getContext);
      }, { concurrency: hardwareConcurrency, memory: deviceMemory });

      const urlToVisit = generateUrl();
      console.log(`[Attempt ${attempt + 1}] Visiting: ${urlToVisit}`);

      // 設置隨機請求頭
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-HK,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Upgrade-Insecure-Requests': '1',
      });

      // 增加超時時間，並使用 domcontentloaded
      await page.goto(urlToVisit, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000
      });

      // 隨機等待 2-5 秒，確保動態載入完成
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      // 檢查是否出現了驗證碼或被屏蔽
      const content = await page.content();
      if (content.includes('Access Denied') || content.includes('Cloudflare') || content.includes('verification')) {
        console.warn('Potential bot detection triggered');
      }

      const cookies = await context.cookies(); // 獲取所有域名的 cookies
      
      console.log(`Successfully obtained ${cookies.length} cookies`);

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
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
    }
  }
}

module.exports = { runScraper };

