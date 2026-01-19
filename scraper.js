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
const DEFAULT_PROXY_SERVER = 'http://cswdzpyn-1:qt5d1bxkin0h@p.webshare.io:80';

function buildProxyConfig(proxyUrl) {
  if (!proxyUrl) return null;
  const parsed = new URL(proxyUrl);
  const username = parsed.username || undefined;
  const password = parsed.password || undefined;
  const authServer = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
  return {
    server: authServer,
    username,
    password,
  };
}

function shouldAllowRequest(request, allowedOrigins) {
  const url = request.url();
  let origin;
  try {
    origin = new URL(url).origin;
  } catch (error) {
    return false;
  }

  if (!allowedOrigins.has(origin)) return false;

  const type = request.resourceType();
  return type === 'document' || type === 'script' || type === 'xhr' || type === 'fetch';
}

async function runScraper(retries = 2) {
  let browser;
  let attempt = 0;

  const proxyServer = process.env.PROXY_SERVER; // 例如 http://user:pass@host:port

  while (attempt <= retries) {
    try {
      console.log(`[Attempt ${attempt + 1}] Launching browser${proxyServer ? ' with proxy' : ''}...`);
      
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ]
      };

      if (proxyServer) {
        launchOptions.proxy = { server: proxyServer };
      }

      browser = await chromium.launch(launchOptions);

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
      const baseUrl = 'https://www.smartplay.lcsd.gov.hk/home';
      const allowedOrigins = new Set([new URL(baseUrl).origin, new URL(urlToVisit).origin]);

      console.log(`[Attempt ${attempt + 1}] Visiting: ${urlToVisit}`);

      const headers = {
        'Accept-Language': 'zh-HK,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': baseUrl,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      };

      // 1) 先嘗試使用 Request API 取得 Set-Cookie（不下載任何子資源）
      console.log(`[Attempt ${attempt + 1}] Step 1: Requesting home page (cookie-only)...`);
      await context.request.get(baseUrl, { timeout: 30_000, headers });

      console.log(`[Attempt ${attempt + 1}] Step 2: Requesting search page (cookie-only)...`);
      await context.request.get(urlToVisit, { timeout: 60_000, headers });

      let cookies = await context.cookies();

      // 2) 若 Request API 沒拿到 cookie，才使用最小資源的頁面載入
      if (cookies.length === 0) {
        console.warn(`[Attempt ${attempt + 1}] No cookies from request API, falling back to minimal page load...`);

        await page.route('**/*', (route) => {
          if (shouldAllowRequest(route.request(), allowedOrigins)) {
            route.continue();
          } else {
            route.abort();
          }
        });

        await page.setExtraHTTPHeaders(headers);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.goto(urlToVisit, { waitUntil: 'domcontentloaded', timeout: 60_000 });

        cookies = await context.cookies();
      }
      
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

