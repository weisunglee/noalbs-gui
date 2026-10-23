// Run against npm run dev -- --port 4173. Only test fixtures reach the mocked IPC.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const config = {
  user: { id: null, name: 'test-stream', passwordHash: null },
  software: { type: 'Obs', host: 'localhost', port: 4455, password: null },
  switcher: { bitrateSwitcherEnabled: true, onlySwitchWhenStreaming: true, instantlySwitchOnRecover: true, autoSwitchNotification: false, retryAttempts: 3, triggers: { low: 1000, rtt: 2500, offline: 300, rttOffline: null }, switchingScenes: { normal: 'Live 原文', low: 'Low', offline: 'Offline' }, streamServers: [] },
  optionalScenes: { starting: null, ending: null, privacy: null, refresh: null },
  optionalOptions: { twitchTranscodingCheck: false, twitchTranscodingRetries: 3, twitchTranscodingDelaySeconds: 5, offlineTimeout: 30, recordWhileStreaming: false, switchToStartingSceneOnStreamStart: false, switchFromStartingSceneToLiveScene: false },
  chat: { platform: 'Twitch', username: 'test-stream', admins: ['Admin'], ignoreUsers: [], language: 'EN', prefix: '!', enablePublicCommands: false, enableModCommands: true, enableAutoStopStreamOnHostOrRaid: true, announceRaidOnAutoStop: true, commands: { Start: { permission: 'Admin', userPermissions: null, alias: null } } },
};
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
try {
 const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
 const errors = [];
 if (process.env.UI_STATIC) {
   const root = path.resolve('dist');
   await page.route('http://127.0.0.1:4173/**', route => {
     const name = new URL(route.request().url()).pathname;
     const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
     if (!file.startsWith(root + path.sep)) return route.abort();
     return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
   });
 }
 page.on('pageerror', error => errors.push(String(error)));
 await page.addInitScript(({ config }) => {
   window.testCalls = [];
   const settings = { binarySource: 'auto', binaryPath: 'C:/NOALBS/noalbs.exe', installedVersion: '2.13.0', workingDir: 'C:/NOALBS', checkUpdatesOnStartup: false, theme: 'light', autoStart: false };
   window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
   window.__TAURI_INTERNALS__ = {
     transformCallback: () => 1,
     invoke: async (command, args) => {
       window.testCalls.push({ command, args });
       if (window.testFailures?.[command]) throw window.testFailures[command];
       if (command === 'get_settings') return settings;
       if (command === 'get_config') return config;
       if (command === 'get_status') return false;
       if (command === 'get_dashboard') return { running: false, uptimeSecs: 3661, version: '2.13.0', status: { obs: 'disconnected', twitch: 'notConfigured', currentScene: 'Live 原文', lastSwitchType: 'Normal', switcherState: 'Waiting for OBS', user: 'test-stream' } };
       if (command === 'get_env') return { twitchBotUsername: 'test-bot', twitchBotOauth: 'oauth:fixture', apiPort: null, logDir: null };
       if (command === 'get_log_buffer') return [{ seq: 1, text: 'Original log: connected / 原文', stream: 'stdout' }];
       if (command === 'save_config') return { config: JSON.parse(args.json), running: !!window.testRunning };
       if (command === 'plugin:dialog|message') return false;
       if (command === 'save_env') return false;
       if (command === 'save_settings') Object.assign(settings, args.settings);
       return 1;
     },
   };
 }, { config });
 await page.goto(process.env.UI_URL || 'http://127.0.0.1:4173');
 const language = page.locator('.language-picker select');
 await language.selectOption('en');
 if (process.env.AUDIT_CASES) {
   await language.selectOption('zh-TW');
   await page.waitForSelector('.dashboard .cards');
   assert.match(await page.locator('.dashboard').innerText(), /等待 OBS 連線/);
   assert.match(await page.locator('.dashboard').innerText(), /1 小時 1 分 1 秒/);
   assert.match(await page.locator('.dashboard').innerText(), /上次切換：正常/);
   assert.match(await page.locator('.dashboard').innerText(), /Live 原文/);
   await page.getByRole('button', { name: '應用程式設定', exact: true }).click();
   await page.waitForSelector('.settings');
   assert.match(await page.locator('.settings').innerText(), /自動下載/);
   await page.evaluate(() => { window.testFailures = { save_settings: 'io error: access denied' }; });
   await page.getByLabel('開啟應用程式時自動啟動 NOALBS').click();
   await page.waitForSelector('.settings .error');
   assert.match(await page.locator('.settings .error').innerText(), /無法讀取或寫入檔案/);
   assert.equal(await page.getByLabel('開啟應用程式時自動啟動 NOALBS').isChecked(), false);
   await page.evaluate(() => { window.testFailures = { clear_logs: 'io error: access denied' }; });
   await page.getByRole('button', { name: '執行日誌', exact: true }).click();
   await page.getByRole('button', { name: '清除', exact: true }).click();
   await page.waitForSelector('.logs .error');
   assert.match(await page.locator('.logs .error').innerText(), /無法讀取或寫入檔案/);
   assert.match(await page.locator('.logs-list').innerText(), /Original log: connected \/ 原文/);
   await page.getByRole('button', { name: '串流設定', exact: true }).click();
   await page.getByRole('button', { name: '進階（JSON）', exact: true }).click();
   await page.locator('.cm-content').waitFor();
   const original = await page.locator('.cm-content').innerText();
   await page.locator('.cm-content').click();
   await page.keyboard.press('Control+f');
   await page.getByPlaceholder('搜尋', { exact: true }).waitFor();
   await page.getByPlaceholder('搜尋', { exact: true }).fill('user');
   await page.getByPlaceholder('取代', { exact: true }).fill('replacement-draft');
   // The native search panel commits input on keyup/change (blur), as real typing does.
   await page.getByPlaceholder('取代', { exact: true }).press('Tab');
   assert.match(await page.locator('.cm-search').innerText(), /全部取代/);
   for (const [locale, find] of [['en', 'Find'], ['zh-CN', '查找'], ['ja', '検索'], ['ko', '찾기'], ['zh-TW', '搜尋']]) {
     await language.selectOption(locale);
     await page.getByPlaceholder(find, { exact: true }).waitFor();
     assert.equal(await page.getByPlaceholder(find, { exact: true }).inputValue(), 'user');
     assert.equal(await page.locator('.cm-search input[name="replace"]').inputValue(), 'replacement-draft');
     assert.equal(await page.locator('.cm-content').innerText(), original);
   }
   await page.getByRole('button', { name: '關閉', exact: true }).click();
   await page.evaluate(() => { window.testRunning = true; window.testFailures = {}; });
   await page.getByRole('button', { name: '儲存', exact: true }).click();
   await page.waitForFunction(() => window.testCalls.some(call => call.command === 'plugin:dialog|message'));
   const dialog = await page.evaluate(() => window.testCalls.filter(call => call.command === 'plugin:dialog|message').at(-1));
   assert.match(JSON.stringify(dialog.args), /確認/);
   assert.match(JSON.stringify(dialog.args), /取消/);
   assert.match(JSON.stringify(dialog.args), /設定已儲存/);
   assert.equal(await page.evaluate(() => window.testCalls.some(call => call.command === 'restart_noalbs')), false);
   assert.deepEqual(errors, []);
   console.log('PASS: dashboard/status/source, editor controls in five locales, untranslated JSON/logs, localized save/clear failures and confirmation buttons.');
 } else if (process.env.ERROR_CASES) {
   await language.selectOption('zh-TW');
   await page.evaluate(() => { window.testFailures = { get_config: 'no working directory or binary path set', get_env: 'no working directory or binary path set', start_noalbs: 'noalbs binary not found; download it or set a manual path' }; });
   await page.getByRole('button', { name: '串流設定', exact: true }).click();
   await page.waitForSelector('main .error');
   assert.match(await page.locator('main').innerText(), /尚未設定工作目錄或主程式路徑/);
   await language.selectOption('ja');
   assert.match(await page.locator('main').innerText(), /作業ディレクトリ/);
   await language.selectOption('zh-TW');
   await page.getByRole('button', { name: '連線與憑證', exact: true }).click();
   await page.waitForSelector('.credentials .error');
   assert.match(await page.locator('.credentials').innerText(), /尚未設定工作目錄或主程式路徑/);
   await page.getByRole('button', { name: '應用程式設定', exact: true }).click();
   await page.getByRole('button', { name: '啟動', exact: true }).click();
   await page.waitForSelector('.settings .error');
   assert.match(await page.locator('.settings').innerText(), /找不到 NOALBS 主程式/);
   console.log('PASS: backend errors localized in Config, credentials and Settings; existing errors follow language changes.');
 } else {
 await page.getByRole('button', { name: 'Config', exact: true }).click();
 await page.getByLabel('Host', { exact: true }).fill('draft-host');
 await page.getByRole('button', { name: 'Connections & credentials', exact: true }).click();
 await page.getByLabel('Twitch bot username').fill('draft-bot');
 assert.equal(await page.locator('input[type=password]').count(), 2); // OBS and token, only token visible
 await language.selectOption('zh-TW');
 await page.getByRole('button', { name: '串流設定', exact: true }).click();
 assert.equal(await page.getByLabel('主機', { exact: true }).inputValue(), 'draft-host');
 assert.equal(await page.getByText('機器人憑證（.env）', { exact: true }).isVisible(), false);
 await page.getByRole('button', { name: '儲存', exact: true }).click();
 const saved = await page.evaluate(() => window.testCalls.filter(call => call.command === 'save_config').at(-1));
 assert.deepEqual(JSON.parse(saved.args.json), { ...config, software: { ...config.software, host: 'draft-host' } });
 await page.getByRole('button', { name: '進階（JSON）', exact: true }).click();
 await page.locator('.cm-content').waitFor();
 const raw = await page.locator('.cm-content').innerText();
 for (const locale of ['en', 'zh-CN', 'ja', 'ko', 'zh-TW']) {
   await language.selectOption(locale);
   assert.equal(await page.locator('.cm-content').innerText(), raw);
   assert.equal(await page.locator('html').getAttribute('lang'), locale);
 }
 await page.getByRole('button', { name: '連線與憑證', exact: true }).click();
 assert.equal(await page.getByLabel('Twitch 機器人名稱').inputValue(), 'draft-bot');
 assert.equal(await page.getByLabel('Twitch 機器人 OAuth').inputValue(), 'oauth:fixture');
 await page.getByRole('button', { name: '儲存憑證', exact: true }).click();
 const env = await page.evaluate(() => window.testCalls.filter(call => call.command === 'save_env').at(-1));
 assert.equal(env.args.values.twitchBotOauth, 'oauth:fixture');
 await page.getByRole('button', { name: '執行日誌', exact: true }).click();
 assert.match(await page.locator('.logs-list').innerText(), /Original log: connected \/ 原文/);
 await language.selectOption('ja');
 assert.match(await page.locator('.logs-list').innerText(), /Original log: connected \/ 原文/);
 await page.reload();
 assert.equal(await language.inputValue(), 'ja');
 await language.selectOption('zh-TW');
 const output = process.env.UI_OUTPUT;
 if (output) { fs.mkdirSync(output, { recursive: true }); await page.screenshot({ path: `${output}/dashboard.png` }); }
 for (const width of [320, 375, 414, 768, 1000, 1440]) {
   await page.setViewportSize({ width, height: 900 });
   for (const locale of ['en', 'zh-TW', 'zh-CN', 'ja', 'ko']) {
     await language.selectOption(locale);
     for (let tab = 0; tab < 5; tab++) {
       await page.locator('nav button').nth(tab).click();
       const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
       assert.equal(overflow, false, `overflow ${width} ${locale} tab ${tab}`);
     }
   }
 }
 await page.setViewportSize({ width: 1000, height: 720 });
 await language.selectOption('zh-TW');
 await page.getByRole('button', { name: '串流設定', exact: true }).click();
 if(output) await page.screenshot({path:`${output}/config.png`});
 await page.getByRole('button', { name: '應用程式設定', exact: true }).click();
 await page.locator('.sidebar').getByLabel('主題', { exact: true }).selectOption('dark');
 await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
 assert.equal(await page.locator('.settings').getByLabel('主題', { exact: true }).inputValue(), 'dark');
 await page.getByRole('button', { name: '連線與憑證', exact: true }).click();
 if(output) await page.screenshot({path:`${output}/credentials-dark.png`});
 assert.deepEqual(errors, []);
 console.log('PASS: five locales, JSON/env/log preservation, unsaved drafts, persistence, dark mode, 150 responsive page checks.');
 }
} finally { await browser.close(); }

