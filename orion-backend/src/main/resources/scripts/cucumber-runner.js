const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runCucumberPlaywright() {
  const inputPath = process.argv[2];
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error(JSON.stringify({ status: 'FAILED', errorMessage: 'Missing configuration payload file' }));
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const { actions = [], viewport = { width: 1280, height: 720 }, options = {}, storageDir = 'storage/screenshots' } = payload;

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const launchOptions = {
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu']
  };

  if (options.ignoreHttpsErrors) {
    launchOptions.args.push('--ignore-certificate-errors', '--ignore-certificate-errors-spki-list');
  }

  if (options.proxyServer) {
    launchOptions.proxy = {
      server: options.proxyServer,
      bypass: options.bypassList || undefined,
      username: options.username || undefined,
      password: options.password || undefined
    };
  }

  let browser;
  const logs = [];
  let passedCount = 0;
  let failedCount = 0;

  try {
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      ignoreHTTPSErrors: !!options.ignoreHttpsErrors
    });
    const page = await context.newPage();

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const type = action.type;
      const startTime = Date.now();
      const actionLog = { stepIndex: i + 1, type, status: 'PASSED' };

      try {
        if (type === 'navigate') {
          actionLog.url = action.url;
          await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: action.timeout || 30000 });
        } else if (type === 'fill') {
          actionLog.selector = action.selector;
          actionLog.value = action.value;
          await page.fill(action.selector, action.value, { timeout: action.timeout || 10000 });
        } else if (type === 'click') {
          actionLog.selector = action.selector;
          await page.click(action.selector, { timeout: action.timeout || 10000 });
        } else if (type === 'waitForElement') {
          actionLog.selector = action.selector;
          await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
        } else if (type === 'screenshot') {
          const filename = `${action.name || 'screenshot_' + (i + 1)}_${Date.now()}.png`;
          const filePath = path.join(storageDir, filename);
          await page.screenshot({ path: filePath, fullPage: true });
          actionLog.screenshotPath = filePath;
        }
        actionLog.durationMs = Date.now() - startTime;
        passedCount++;
      } catch (err) {
        actionLog.status = 'FAILED';
        actionLog.errorMessage = err.message;
        actionLog.durationMs = Date.now() - startTime;
        failedCount++;
        logs.push(actionLog);
        throw err;
      }
      logs.push(actionLog);
    }

    console.log(JSON.stringify({
      status: 'PASSED',
      engine: 'CUCUMBER_JS',
      passedActions: passedCount,
      failedActions: failedCount,
      logs
    }));
  } catch (err) {
    console.log(JSON.stringify({
      status: 'FAILED',
      engine: 'CUCUMBER_JS',
      errorMessage: err.message,
      passedActions: passedCount,
      failedActions: failedCount,
      logs
    }));
  } finally {
    if (browser) await browser.close();
  }
}

runCucumberPlaywright();
