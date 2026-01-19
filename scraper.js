const { chromium } = require('playwright-chromium');
const { generateUrl } = require('./url_generator');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

const LOCALES = ['zh-HK', 'zh-CN', 'en-US', 'en-GB'];
const TIMEZONES = ['Asia/Hong_Kong', 'Asia/Shanghai'];

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

const DEFAULT_PROXY_SERVER = 'http://cswdzpyn-HK-1:qt5d1bxkin0h@p.webshare.io:80';

function buildProxyConfig(proxyUrl) {
  if (!proxyUrl) return null;
  try {
    const parsed = new URL(proxyUrl);
    const config = {
      server: `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`,
    };
    
    if (parsed.username) {
      config.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      config.password = decodeURIComponent(parsed.password);
    }
    
    return config;
  } catch (error) {
    console.error('Invalid proxy URL:', error.message);
    return null;
  }
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

  const proxyServer = process.env.PROXY_SERVER || DEFAULT_PROXY_SERVER;
  
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

      // 修复：正确应用 proxy 配置
      if (proxyServer) {
        const proxyConfig = buildProxyConfig(proxyServer);
        if (proxyConfig) {
          launchOptions.proxy = proxyConfig;
          console.log(`Using proxy: ${proxyConfig.server}`);
        }
      }

      browser = await chromium.launch(launchOptions);

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
        ignoreHTTPSErrors: true, // 添加：忽略 HTTPS 错误（代理可能需要）
      });

      const page = await context.newPage();

      // 修复：深度伪装脚本
      await page.addInitScript(({ concurrency, memory }) => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => concurrency });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => memory });
        
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
            { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' },
          ],
        });

        // 修复：正确伪装 WebGL
        if (window.WebGLRenderingContext) {
          const getParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(param) {
            if (param === 37445) return 'Intel Inc.';
            if (param === 37446) return 'Intel(R) Iris(R) Xe Graphics';
            return getParameter.call(this, param);
          };
        }

        // 添加：伪装 Chrome runtime
        window.chrome = {
          runtime: {},
        };
      }, { concurrency: hardwareConcurrency, memory: deviceMemory });

      const targetUrl = generateUrl();
      const allowedOrigins = new Set([new URL(targetUrl).origin]);

      console.log(`[Attempt ${attempt + 1}] Visiting: ${targetUrl}`);

      const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-HK,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      };

      // 改进：直接使用页面加载，但优化资源过滤
      await page.route('**/*', (route) => {
        if (shouldAllowRequest(route.request(), allowedOrigins)) {
          route.continue();
        } else {
          route.abort();
        }
      });

      await page.setExtraHTTPHeaders(headers);
      
      // 修改：使用 networkidle 确保 JS 执行完毕
      await page.goto(targetUrl, { 
        waitUntil: 'networkidle', 
        timeout: 60_000 
      });

      // 额外等待确保 cookie 设置完成
      await page.waitForTimeout(2000);

      const cookies = await context.cookies();
      console.log(`Successfully obtained ${cookies.length} cookies`);

      if (cookies.length === 0) {
        throw new Error('No cookies obtained');
      }

      await browser.close();
      return { url: targetUrl, cookies, attempt: attempt + 1 };

    } catch (err) {
      console.error(`Attempt ${attempt + 1} failed:`, err.message);
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          console.error('Error closing browser:', closeErr.message);
        }
      }
      attempt++;
      if (attempt > retries) throw err;
      
      // 指数退避
      const delay = 3000 + Math.random() * 2000 * attempt;
      console.log(`Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = { runScraper };