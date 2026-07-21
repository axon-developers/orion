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
  const screenshots = [];
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
      const actionLog = { index: i, type, status: 'SUCCESS' };

      try {
        if (type === 'navigate') {
          actionLog.url = action.url;
          actionLog.message = `Navigated to ${action.url}`;
          await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: action.timeout || 30000 });
        } else if (type === 'fill') {
          actionLog.selector = action.selector;
          actionLog.value = action.value;
          actionLog.message = `Filled selector ${action.selector}`;
          await page.fill(action.selector, action.value, { timeout: action.timeout || 10000 });
        } else if (type === 'click') {
          actionLog.selector = action.selector;
          actionLog.message = `Clicked selector ${action.selector}`;
          await page.click(action.selector, { timeout: action.timeout || 10000 });
        } else if (type === 'waitForElement') {
          actionLog.selector = action.selector;
          actionLog.message = `Element visible: ${action.selector}`;
          await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
        } else if (type === 'screenshot') {
          const name = action.name || ('screenshot_' + i);
          const filename = `${name}_${Date.now()}.png`;
          const filePath = path.join(storageDir, filename);
          const fullPage = action.fullPage === true || action.fullPage === 'true';
          await page.screenshot({ path: filePath, fullPage: fullPage });

          actionLog.name = name;
          actionLog.filename = filename;
          actionLog.screenshotPath = filePath;
          actionLog.message = `Screenshot taken: ${name}`;

          screenshots.push({
            name: name,
            filename: filename,
            path: `${storageDir}/${filename}`
          });
        }
        actionLog.durationMs = Date.now() - startTime;
        passedCount++;
      } catch (err) {
        actionLog.status = 'FAILED';
        actionLog.error = err.message;
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
      actions: logs,
      logs: logs,
      screenshots: screenshots,
      message: 'Browser automation completed successfully.'
    }));
  } catch (err) {
    console.log(JSON.stringify({
      status: 'FAILED',
      engine: 'CUCUMBER_JS',
      errorMessage: err.message,
      passedActions: passedCount,
      failedActions: failedCount,
      actions: logs,
      logs: logs,
      screenshots: screenshots
    }));
  } finally {
    if (browser) await browser.close();
  }
}

runCucumberPlaywright();
