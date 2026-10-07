import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.clock.install({ time: new Date('2026-09-29T10:00:00+08:00') });
  await page.goto('/');
  await page.getByRole('button', { name: '开始我的饮品日记' }).click();
  await expect(page.getByRole('heading', { name: '今天，喝了些什么？' })).toBeVisible();
}
async function choose(page: Page, name: string) {
  await page.getByRole('link', { name: '添加饮品', exact: true }).last().click();
  await page.getByRole('textbox', { name: '搜索饮品' }).fill(name);
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
  await expect(page.getByRole('heading', { name: '记录这一杯' })).toBeVisible();
}
async function save(page: Page) {
  await page.getByRole('button', { name: '保存这一杯', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('这一杯，已经记下了。');
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
}
async function selectDate(page: Page, date: string) {
  await page.getByRole('button', { name: /^饮用日期筛选/ }).click();
  await page.getByRole('dialog', { name: '选择饮用日期' }).getByRole('button', { name: date, exact: true }).click();
}
async function seed(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('cup-ledger'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const items = [
        { name: '水', typeId: 'water-plain', category: 'water', plainWater: true, volume: 250, caffeine: 0, sugar: 0, quantity: 3 },
        { name: '拿铁咖啡', typeId: 'coffee-latte', category: 'coffee', plainWater: false, volume: 300, caffeine: 80, sugar: 12, quantity: 1 },
        { name: '绿茶', typeId: 'tea-green', category: 'tea', plainWater: false, volume: 300, caffeine: 36, sugar: 0, quantity: 1 },
        { name: '橙汁', typeId: 'juice-orange', category: 'juice', plainWater: false, volume: 250, caffeine: 0, sugar: 20, quantity: 1 },
        { name: '拿铁咖啡', typeId: 'coffee-latte', category: 'coffee', plainWater: false, volume: 300, caffeine: 80, sugar: 12, quantity: 1 },
      ];
      items.forEach((item, index) => tx.objectStore('records').put({ ...item, id: `seed-${index}`, templateId: item.typeId, consumedAt: `2026-09-29T00:${index}0:00.000Z`, dayKey: '2026-09-29', nutrition: { caffeine: item.caffeine, sugar: item.sugar, protein: 2, calories: 30, alcohol: 0 }, sources: { caffeine: 'estimated', sugar: 'estimated', protein: 'estimated', calories: 'estimated', alcohol: 'estimated' }, abv: null, alcoholManual: false, specification: '' }));
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); db.close();
  });
  await page.reload();
}
test('first use, search, configure, save, move to another day, and delete stay consistent', async ({ page }) => {
  await start(page);
  await choose(page, '美式咖啡');
  await page.getByRole('spinbutton', { name: '准确容量', exact: true }).fill('350');
  await page.getByRole('button', { name: '增加份数' }).click();
  await expect(page.getByRole('region', { name: '本次合计' })).toContainText('280');
  await noOverflow(page);
  await save(page);
  await expect(page.getByRole('progressbar', { name: '咖啡因', exact: true })).toHaveAttribute('aria-valuenow', '280');
  await expect(page.getByRole('progressbar', { name: '水', exact: true })).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('link', { name: '统计', exact: true }).click();
  const metricPicker = page.getByRole('button', { name: /水.*ml/ });
  await expect(metricPicker).toBeVisible();
  await metricPicker.click();
  await expect(page.getByRole('listbox', { name: '选择统计指标' })).toBeVisible();
  await page.getByRole('option', { name: /咖啡因.*mg/ }).click();
  await expect(page.getByRole('button', { name: /咖啡因.*mg/ })).toBeVisible();
  await expect(page.getByText('日均按 2 个自然日计算，截至今天。')).toBeVisible();
  await expect(page.getByText('日均 140 mg', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '记录', exact: true }).click();
  await page.getByRole('link', { name: '编辑 美式咖啡' }).click();
  await page.getByLabel('饮用时间', { exact: true }).fill('2026-09-28T08:00');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByRole('progressbar', { name: '咖啡因', exact: true })).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('link', { name: '记录', exact: true }).click();
  await selectDate(page, '2026-09-28');
  await page.getByRole('button', { name: /饮品类别筛选/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '咖啡', exact: true }).click();
  await expect(page.getByRole('link', { name: '编辑 美式咖啡' })).toHaveCount(1);
  await page.getByRole('link', { name: '编辑 美式咖啡' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '删除这条记录' }).click();
  await expect(page.getByRole('heading', { name: '还没有找到记录' })).toBeVisible();
  await page.getByRole('link', { name: '统计', exact: true }).click();
  await expect(page.getByRole('heading', { name: '这段时间，还没有记录' })).toBeVisible();
});
test('saving still works when randomUUID is unavailable on a LAN HTTP origin', async ({ page }) => {
  await start(page);
  await page.evaluate(() => Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined }));
  await choose(page, '水');
  await save(page);
  await expect(page.getByRole('progressbar', { name: '水', exact: true })).toHaveAttribute('aria-valuenow', '250');
});
test('plain water qualifies, sparkling water does not, and loaded app works offline', async ({ page, context }) => {
  await start(page);
  await context.setOffline(true);
  await choose(page, '水');
  await page.getByRole('spinbutton', { name: '准确容量', exact: true }).fill('500');
  await page.getByRole('spinbutton', { name: '份数', exact: true }).fill('2');
  await save(page);
  await choose(page, '无糖气泡水');
  await save(page);
  await expect(page.getByRole('progressbar', { name: '水', exact: true })).toHaveAttribute('aria-valuenow', '1000');
  await page.getByRole('link', { name: '统计', exact: true }).click();
  await expect(page.getByText('日均 500 ml', { exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await page.getByRole('link', { name: '今日', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: '水', exact: true })).toHaveAttribute('aria-valuenow', '1000');
});
test('custom drink editing and deletion preserve history and missing nutrition', async ({ page }) => {
  await start(page);
  await page.getByRole('link', { name: '我的', exact: true }).click();
  await page.getByRole('link', { name: /饮品管理/ }).click();
  await page.getByRole('link', { name: /创建自定义饮品/ }).click();
  const name = '我的桂花燕麦拿铁特别大杯少冰配方';
  await page.getByRole('textbox', { name: '饮品名称' }).fill(name);
  await page.getByRole('spinbutton', { name: '饮品总糖', exact: true }).fill('4');
  await page.getByRole('spinbutton', { name: '蛋白质', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: '热量', exact: true }).fill('30');
  await page.getByRole('button', { name: '保存饮品', exact: true }).click();
  await expect(page.getByRole('heading', { name: '饮品管理' })).toBeVisible();
  await page.goto('/');
  await choose(page, name);
  await page.getByRole('spinbutton', { name: '份数', exact: true }).fill('2');
  await noOverflow(page);
  await save(page);
  await expect(page.getByRole('link', { name: `编辑 ${name}` })).toContainText('咖啡因 未填写');
  await expect(page.getByRole('link', { name: `编辑 ${name}` })).toContainText('饮品总糖 20 g');
  await page.getByRole('link', { name: '我的', exact: true }).click();
  await page.getByRole('link', { name: /饮品管理/ }).click();
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
  await page.getByRole('spinbutton', { name: '饮品总糖', exact: true }).fill('12');
  await page.getByRole('button', { name: '保存饮品', exact: true }).click();
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '删除自定义饮品' }).click();
  await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('link', { name: `编辑 ${name}` })).toContainText('饮品总糖 20 g');
  await page.getByRole('link', { name: `编辑 ${name}` }).click();
  await expect(page.getByRole('spinbutton', { name: '饮品总糖', exact: true })).toHaveValue('10');
});
test('updated defaults affect new records while old record editing starts from the snapshot', async ({ page }) => {
  await start(page);
  await choose(page, '美式咖啡'); await save(page);
  await choose(page, '美式咖啡');
  await page.getByRole('spinbutton', { name: '咖啡因', exact: true }).fill('50');
  await page.getByLabel('更新该饮品默认值').check();
  await save(page);
  await choose(page, '美式咖啡');
  await expect(page.getByRole('spinbutton', { name: '咖啡因', exact: true })).toHaveValue('50');
  await page.goto('/records');
  const records = page.getByRole('link', { name: '编辑 美式咖啡' });
  await expect(records).toHaveCount(2);
  await records.filter({ hasText: '咖啡因 100 mg' }).click();
  await expect(page.getByRole('spinbutton', { name: '咖啡因', exact: true })).toHaveValue('100');
  await expect(page.getByRole('button', { name: '按单份填写' })).toHaveAttribute('aria-pressed', 'true');
});
test('alcohol manual override survives volume and ABV changes and can return to estimation', async ({ page }) => {
  await start(page);
  await choose(page, '啤酒');
  await expect(page.getByRole('spinbutton', { name: '单份纯酒精', exact: true })).toHaveValue('13.0185');
  await page.getByRole('spinbutton', { name: '单份纯酒精', exact: true }).fill('8');
  await page.getByRole('spinbutton', { name: '准确容量', exact: true }).fill('500');
  await page.getByRole('spinbutton', { name: '酒精度 ABV', exact: true }).fill('10');
  await expect(page.getByText('手动值已保留；改变容量或酒精度不会自动覆盖。')).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: '单份纯酒精', exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: '恢复按酒精度估算' }).click();
  await expect(page.getByRole('spinbutton', { name: '单份纯酒精', exact: true })).toHaveValue('39.45');
  await save(page);
  await expect(page.getByRole('link', { name: '编辑 啤酒' })).toContainText('纯酒精 39.5 g');
});
test('week/month calendars show one proportionate drink icon, and year has no calendar', async ({ page }, testInfo) => {
  await start(page); await seed(page);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('today-mobile.png'), fullPage: true });
  await page.getByRole('link', { name: '统计', exact: true }).click();
  const day = page.getByRole('button', { name: '2026-09-29，4 种饮品', exact: true });
  await expect(day).toBeVisible();
  await expect(day.locator('[title]')).toHaveCount(1);
  await expect(day.locator('[aria-hidden="true"]')).toHaveCSS('background-color', 'rgb(211, 181, 157)');
  expect(await day.locator('[aria-hidden="true"]').evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await day.evaluate(el => getComputedStyle(el).backgroundColor));
  const originalViewport = page.viewportSize()!;
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    const badge = day.locator('[aria-hidden="true"]');
    await expect(badge).toHaveCSS('width', width >= 700 ? '40px' : '34px');
    await expect(badge).toHaveCSS('height', width >= 700 ? '40px' : '34px');
    await expect(badge).toHaveCSS('font-size', width >= 700 ? '28px' : '25px');
    const iconBounds = (await badge.boundingBox())!;
    const dayBounds = (await day.boundingBox())!;
    expect(iconBounds.x).toBeGreaterThanOrEqual(dayBounds.x);
    expect(iconBounds.x + iconBounds.width).toBeLessThanOrEqual(dayBounds.x + dayBounds.width);
    expect(iconBounds.y).toBeGreaterThanOrEqual(dayBounds.y + 24);
    expect(iconBounds.y + iconBounds.height).toBeLessThanOrEqual(dayBounds.y + dayBounds.height);
    await noOverflow(page);
    await page.getByRole('region', { name: '周日历' }).screenshot({ path: testInfo.outputPath(`calendar-${width}.png`) });
  }
  await page.setViewportSize(originalViewport);
  await page.getByRole('button', { name: '月', exact: true }).click();
  await expect(day.locator('[title]')).toHaveCount(1);
  await day.click();
  await expect(page.getByRole('link', { name: '编辑 拿铁咖啡' })).toHaveCount(2);
  await expect(page.getByText('日均按 29 个自然日计算，截至今天。')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('month-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '年', exact: true }).click();
  await expect(page.getByRole('region', { name: /日历/ })).toHaveCount(0);
  await expect(page.getByText('日均按 272 个自然日计算，截至今天。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '水', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '上一个周期' }).click();
  await expect(page.getByText('日均按 365 个自然日计算，包含没有记录的日期。')).toBeVisible();
  await noOverflow(page);
});

test('custom category field uses text while its picker keeps icons, focus and persistence', async ({ page }, testInfo) => {
  await start(page);
  await page.goto('/templates/new');
  await page.getByRole('textbox', { name: '饮品名称' }).fill('我的图标分类茶');
  const trigger = page.getByRole('button', { name: /^饮品类别：/ });
  await expect(trigger).toHaveText('咖啡');
  await expect(trigger.locator('span[aria-hidden="true"]')).toHaveCount(0);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await trigger.screenshot({ path: testInfo.outputPath(`custom-category-field-${width}.png`) });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '选择饮品类别' });
    const options = dialog.getByRole('group', { name: '饮品类别选项' }).getByRole('button');
    await expect(options).toHaveCount(11);
    await expect(options.locator('span[aria-hidden="true"]')).toHaveCount(11);
    await expect(dialog.getByRole('button', { name: '咖啡', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('button', { name: '咖啡', exact: true }).locator('span[aria-hidden="true"]')).toHaveCSS('background-color', 'rgb(211, 181, 157)');
    await noOverflow(page);
    await dialog.screenshot({ path: testInfo.outputPath(`custom-categories-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await trigger.click();
  await page.getByRole('dialog').getByRole('button', { name: '水', exact: true }).click();
  const plainWater = page.getByRole('checkbox', { name: /计入水/ });
  await plainWater.check();
  await trigger.click();
  await page.getByRole('dialog').getByRole('button', { name: '茶', exact: true }).click();
  await trigger.click();
  await page.getByRole('dialog').getByRole('button', { name: '水', exact: true }).click();
  await expect(plainWater).not.toBeChecked();
  await trigger.click();
  await page.getByRole('dialog').getByRole('button', { name: '酒精饮品', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '酒精度 ABV', exact: true })).toBeVisible();
  await trigger.click();
  await page.getByRole('dialog').getByRole('button', { name: '茶', exact: true }).click();
  await expect(page.getByRole('heading', { name: '创建自定义饮品' })).toBeVisible();
  await page.getByRole('button', { name: '保存饮品', exact: true }).click();
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name: '我的图标分类茶', exact: true }) }).click();
  await page.reload();
  await expect(trigger).toHaveText('茶');
  await expect(trigger.locator('span[aria-hidden="true"]')).toHaveCount(0);
  await page.goto('/templates/coffee-americano');
  await expect(trigger).toBeDisabled();
});
test('all local data clearing requires two confirmations and resets onboarding', async ({ page }) => {
  await start(page); await choose(page, '水'); await save(page);
  await page.getByRole('link', { name: '我的', exact: true }).click();
  await page.getByRole('button', { name: /清空本地数据/ }).click();
  await page.getByRole('button', { name: '保留数据' }).click();
  await expect(page.getByText('已收藏 1 条日常', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /清空本地数据/ }).click();
  await page.getByRole('button', { name: '继续清空' }).click();
  await page.getByRole('button', { name: '确认永久清空' }).click();
  await expect(page.getByRole('heading', { name: '从今天的第一杯开始' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '开始我的饮品日记' }).click();
  await expect(page.getByRole('link', { name: '编辑 水' })).toHaveCount(0);
});
test('reference status uses text and today refreshes after midnight', async ({ page }) => {
  await start(page);
  await choose(page, '美式咖啡');
  await page.getByRole('spinbutton', { name: '咖啡因', exact: true }).fill('200');
  await save(page);
  await expect(page.getByText('超出 100 mg', { exact: false })).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-09-30T00:00:05+08:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('progressbar', { name: '咖啡因', exact: true })).toHaveAttribute('aria-valuenow', '0');
});
test('specifications, per-serving conversion, and sweetness update totals accurately', async ({ page }, testInfo) => {
  await start(page);
  await choose(page, '经典奶茶');
  await page.getByRole('combobox', { name: '甜度', exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: '按单份填写', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '饮品总糖', exact: true })).toHaveValue('30');
  await expect(page.getByRole('spinbutton', { name: '热量', exact: true })).toHaveValue('245');
  await page.getByRole('spinbutton', { name: '份数', exact: true }).fill('2');
  await expect(page.getByRole('region', { name: '本次合计' })).toContainText('60');
  await page.getByRole('button', { name: '按每 100 ml 填写', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '饮品总糖', exact: true })).toHaveValue('6');
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('configure-mobile.png'), fullPage: true });
  await save(page);
  await expect(page.getByRole('link', { name: '编辑 经典奶茶' })).toContainText('半糖');
  await expect(page.getByRole('link', { name: '编辑 经典奶茶' })).toContainText('饮品总糖 60 g');
  await choose(page, '美式咖啡');
  await page.getByRole('combobox', { name: '饮品类型', exact: true }).selectOption('decaf');
  await expect(page.getByRole('spinbutton', { name: '咖啡因', exact: true })).toHaveValue('2');
  await save(page);
  await expect(page.getByRole('link', { name: '编辑 美式咖啡' })).toContainText('咖啡因 5 mg');
});
test('category colors stay consistent and narrow screens keep the last record reachable', async ({ page }, testInfo) => {
  await start(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await choose(page, '水');
  const formColor = await page.locator('span[aria-hidden="true"]').first().evaluate(el => getComputedStyle(el).backgroundColor);
  await save(page);
  const row = page.getByRole('link', { name: '编辑 水' });
  const rowColor = await row.locator('span[aria-hidden="true"]').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(rowColor).toBe(formColor);
  await noOverflow(page);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.getByRole('heading', { name: '编辑饮品记录' })).toBeVisible();
  await page.goto('/stats');
  await page.getByRole('button', { name: '月', exact: true }).click();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('narrow-month.png'), fullPage: true });
});
test('blank alcohol fields remain blank when editing a saved snapshot', async ({ page }) => {
  await start(page);
  await choose(page, '啤酒');
  await page.getByRole('spinbutton', { name: '酒精度 ABV', exact: true }).fill('');
  await page.getByRole('spinbutton', { name: '单份纯酒精', exact: true }).fill('');
  await save(page);
  await expect(page.getByRole('link', { name: '编辑 啤酒' })).toContainText('纯酒精 未填写');
  await page.getByRole('link', { name: '编辑 啤酒' }).click();
  await expect(page.getByRole('spinbutton', { name: '酒精度 ABV', exact: true })).toBeEmpty();
  await expect(page.getByRole('spinbutton', { name: '单份纯酒精', exact: true })).toBeEmpty();
});

test('today and records keep one inline entry, with readable compact empty states', async ({ page }, testInfo) => {
  await start(page);
  for (const path of ['/', '/records']) {
    await page.goto(path);
    const entry = page.getByRole('link', { name: '添加饮品', exact: true });
    await expect(entry).toHaveCount(1);
    expect(await entry.evaluate(el => getComputedStyle(el).position)).not.toBe('fixed');
    expect(await entry.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 249, 242)');
    if (path === '/records') await expect(page.getByRole('region', { name: '记录概览' })).toContainText('0 条记录');
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(path === '/' ? 'today-empty.png' : 'records-empty.png'), fullPage: true });
  }
  await choose(page, '水'); await save(page);
  await expect(page.getByRole('link', { name: '添加饮品', exact: true })).toHaveCount(1);
  await page.goto('/records');
  await expect(page.getByRole('region', { name: '记录概览' })).toContainText('1 条记录');
  await expect(page.getByRole('link', { name: '添加饮品', exact: true })).toHaveCount(1);
  const record = page.getByRole('link', { name: '编辑 水', exact: true });
  const textStyle = await record.locator('em').last().evaluate(el => ({ size: parseFloat(getComputedStyle(el).fontSize), spacing: parseFloat(getComputedStyle(el).letterSpacing) }));
  expect(textStyle.size).toBeGreaterThanOrEqual(13);
  expect(textStyle.spacing).toBeGreaterThan(0);
  await page.setViewportSize({ width: 320, height: 720 });
  await noOverflow(page);
});

test('picker shows the requested category order and beverage options', async ({ page }, testInfo) => {
  await start(page);
  await page.getByRole('link', { name: '添加饮品', exact: true }).click();
  await expect(page.locator('main section h2')).toHaveText(['水', '茶', '咖啡', '奶茶', '果汁', '牛奶', '碳酸饮料', '能量饮料', '运动饮料', '酒精饮品', '其他种类']);
  const choices = (category: string) => page.locator('main section').filter({ has: page.getByRole('heading', { name: category, exact: true }) });
  await expect(choices('水').locator('h3').filter({ hasText: /^水$/ })).toBeVisible();
  for (const name of ['全脂牛奶', '低脂牛奶', '脱脂牛奶']) await expect(choices('牛奶').locator('h3').filter({ hasText: name })).toBeVisible();
  for (const name of ['百事 · 百事可乐', '可口可乐 · 可口可乐', '可乐', '无糖可乐', '雪碧', '芬达橙味']) await expect(choices('碳酸饮料').locator('h3').filter({ hasText: new RegExp(`^${name}$`) })).toBeVisible();
  await expect(page.getByRole('heading', { name: '摩卡', exact: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '澳白', exact: true })).toHaveCount(1);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('picker.png'), fullPage: true });
});

for (const origin of ['/', '/records']) {
  test(`custom drink cancel and save preserve the add flow from ${origin}`, async ({ page }) => {
    await start(page);
    await page.goto(origin);
    await page.getByRole('link', { name: '添加饮品', exact: true }).click();
    const pickerUrl = page.url();
    await page.getByRole('link', { name: '自定义饮品 +' }).click();
    await page.reload();
    await page.getByRole('link', { name: '返回', exact: true }).click();
    await expect(page).toHaveURL(pickerUrl);
    await page.getByRole('heading', { name: '选择一杯饮品' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('link', { name: '返回', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${origin === '/' ? '/' : '/records'}$`));
    await page.getByRole('link', { name: '添加饮品', exact: true }).click();
    await page.getByRole('textbox', { name: '搜索饮品' }).fill('尚未收录的饮品');
    await page.getByRole('link', { name: '创建自定义饮品', exact: true }).click();
    await page.getByRole('textbox', { name: '饮品名称' }).fill('我的新饮品');
    await page.getByRole('button', { name: '保存饮品', exact: true }).click();
    await expect(page).toHaveURL(pickerUrl);
    await expect(page.getByRole('heading', { name: '我的新饮品', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '返回', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${origin === '/' ? '/' : '/records'}$`));
  });
}

test('bundled Chinese font loads and supporting text stays readable on phones', async ({ page }, testInfo) => {
  const fontRequests: string[] = [];
  page.on('response', response => {
    if (response.url().includes('.woff2') && response.ok()) fontRequests.push(response.url());
  });
  await start(page);
  for (const route of ['/', '/stats', '/profile', '/records', '/add']) {
    await page.goto(route);
    await page.locator('h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator('h1').evaluate(el => {
      const style = getComputedStyle(el);
      return document.fonts.check(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, el.textContent ?? '');
    })).toBeTruthy();
    await expect(page.locator('body')).toHaveCSS('font-weight', '500');
    await expect(page.locator('body')).toHaveCSS('font-family', /Noto Sans SC Variable/);
    const smallText = page.locator('main p, main small').filter({ visible: true });
    const sizes = await smallText.evaluateAll(nodes => nodes.map(el => parseFloat(getComputedStyle(el).fontSize)));
    expect(sizes.every(size => size >= 15)).toBeTruthy();
    if (route === '/profile') {
      await expect(page.getByRole('link', { name: /饮品管理/ }).locator('strong')).toHaveCSS('font-size', '18px');
      await expect(page.getByRole('link', { name: /饮品管理/ }).locator('strong')).toHaveCSS('font-weight', '650');
    }
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`font-${route.replaceAll('/', '') || 'today'}.png`), fullPage: true });
    await page.setViewportSize({ width: 320, height: 720 });
    await noOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
  }
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(fontRequests.every(url => new URL(url).origin === 'http://127.0.0.1:4173')).toBeTruthy();
});

test('date calendar filters records, clears dates and fits mobile and desktop viewports', async ({ page }, testInfo) => {
  await start(page); await seed(page);
  await page.getByRole('link', { name: '记录', exact: true }).click();
  const display = page.getByTestId('date-display');
  const trigger = page.getByRole('button', { name: /^饮用日期筛选/ });
  const dialog = page.getByRole('dialog', { name: '选择饮用日期' });
  await expect(display).toHaveText('年 / 月 / 日');
  await expect(display).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.getByRole('button', { name: '2026-09-29', exact: true })).toHaveAttribute('aria-current', 'date');
    await expect(dialog.getByRole('group', { name: '日期选择' }).getByRole('button')).toHaveCount(42);
    await noOverflow(page);
    await dialog.screenshot({ path: testInfo.outputPath(`date-calendar-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await selectDate(page, '2026-09-29');
  await expect(display).toHaveText('2026/09/29');
  await expect(page.getByRole('link', { name: /^编辑 / })).toHaveCount(5);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByRole('button', { name: '2026-09-29', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('button', { name: '2026-09-28', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(display).toHaveText('2026/09/28');
  await expect(page.getByRole('link', { name: /^编辑 / })).toHaveCount(0);
  await trigger.click();
  await dialog.getByRole('button', { name: '清除日期', exact: true }).click();
  await expect(display).toHaveText('年 / 月 / 日');
  await expect(page.getByRole('link', { name: /^编辑 / })).toHaveCount(5);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('record-filters.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  await noOverflow(page);
});

test('date calendar navigates months, years and leap days, and today preserves category filtering', async ({ page }) => {
  await start(page); await seed(page);
  await page.goto('/records');
  const trigger = page.getByRole('button', { name: /^饮用日期筛选/ });
  const dialog = page.getByRole('dialog', { name: '选择饮用日期' });
  await trigger.click();
  await dialog.getByRole('button', { name: '选择月份', exact: true }).click();
  await dialog.getByRole('button', { name: '上一年', exact: true }).click();
  await dialog.getByRole('button', { name: '上一年', exact: true }).click();
  await dialog.getByRole('button', { name: '2 月', exact: true }).click();
  await dialog.getByRole('button', { name: '2024-02-29', exact: true }).click();
  await expect(page.getByTestId('date-display')).toHaveText('2024/02/29');
  await trigger.click();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('button', { name: '2024-03-01', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('date-display')).toHaveText('2024/03/01');
  await trigger.click();
  await dialog.getByRole('button', { name: '选择月份', exact: true }).click();
  await dialog.getByRole('button', { name: '下一年', exact: true }).click();
  await dialog.getByRole('button', { name: '12 月', exact: true }).click();
  await dialog.getByRole('button', { name: '下个月', exact: true }).click();
  await dialog.getByRole('button', { name: '2026-01-01', exact: true }).click();
  await expect(page.getByTestId('date-display')).toHaveText('2026/01/01');
  await trigger.click();
  await dialog.getByRole('button', { name: '上个月', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '2025-12-31', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '关闭日期选择', exact: true }).click();
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: /^饮品类别筛选/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '咖啡', exact: true }).click();
  await trigger.click();
  await dialog.getByRole('button', { name: '今天', exact: true }).click();
  await expect(page.getByTestId('date-display')).toHaveText('2026/09/29');
  await expect(page.getByRole('link', { name: /^编辑 / })).toHaveCount(2);
  await trigger.click();
  await page.keyboard.press('PageUp');
  await expect(dialog.getByRole('button', { name: '2026-08-29', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await trigger.click();
  await dialog.getByRole('button', { name: '清除日期', exact: true }).click();
  await expect(page.getByRole('button', { name: /^饮品类别筛选/ })).toContainText('咖啡');
  await expect(page.getByRole('link', { name: /^编辑 / })).toHaveCount(2);
});

test('category sheet filters by selection, shows active state and restores focus on dismissal', async ({ page }, testInfo) => {
  await start(page); await seed(page);
  await page.getByRole('link', { name: '记录', exact: true }).click();
  const trigger = page.getByRole('button', { name: /饮品类别筛选/ });
  const dialog = page.getByRole('dialog', { name: '想回看哪一类？' });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.getByRole('button', { name: '全部类别', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: '咖啡', exact: true })).toContainText('2 条记录');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('category-sheet.png') });
  await dialog.getByRole('button', { name: '咖啡', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText('咖啡');
  await expect(page.getByRole('link', { name: /^编辑 / })).toHaveCount(2);
  await trigger.click();
  await expect(dialog.getByRole('button', { name: '咖啡', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 320, height: 720 });
  await trigger.click();
  await noOverflow(page);
  await dialog.getByRole('button', { name: '其他种类', exact: true }).click();
  await expect(page.getByRole('link', { name: /^编辑 / })).toHaveCount(0);
  await trigger.click();
  await dialog.getByRole('button', { name: '全部类别', exact: true }).click();
  await expect(page.getByRole('link', { name: /^编辑 / })).toHaveCount(5);
  await page.setViewportSize({ width: 1024, height: 768 });
  await trigger.click();
  await dialog.getByRole('button', { name: '关闭类别选择' }).click();
  await expect(trigger).toBeFocused();
});

test('measurement colors are warm and statistics align centrally across periods', async ({ page }, testInfo) => {
  await start(page);
  await expect(page.getByRole('link', { name: '今日', exact: true }).locator('svg')).toHaveClass(/lucide-calendar-days/);
  const daily = page.getByRole('region', { name: '摄入指标' });
  await expect(daily.getByText('水', { exact: true })).toHaveCSS('color', 'rgb(102, 88, 79)');
  await page.getByRole('link', { name: '统计', exact: true }).click();
  const metrics = page.getByRole('group', { name: '周期摄入指标' });
  for (const period of ['周', '月', '年']) {
    await page.getByRole('button', { name: period, exact: true }).click();
    await expect(metrics).toHaveCSS('text-align', 'center');
    await expect(metrics.locator('p').first()).toHaveCSS('color', 'rgb(120, 96, 79)');
    await expect(metrics.locator(':scope > div')).toHaveCount(6);
    await noOverflow(page);
  }
  await page.evaluate(() => document.fonts.ready);
  await metrics.screenshot({ path: testInfo.outputPath('centered-metrics.png') });
});


test('water is labeled as water, caffeine and sugar bars use warm red, and preferences omit water', async ({ page }) => {
  await start(page); await seed(page);
  await expect(page.getByRole('progressbar', { name: '水', exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '白水', exact: true })).toHaveCount(0);
  const caffeineBar = page.getByRole('progressbar', { name: '咖啡因', exact: true }).locator('i');
  const sugarBar = page.getByRole('progressbar', { name: '饮品总糖', exact: true }).locator('i');
  await expect(caffeineBar).toHaveCSS('background-color', 'rgb(196, 106, 93)');
  await expect(sugarBar).toHaveCSS('background-color', 'rgb(185, 87, 78)');
  await page.getByRole('link', { name: '统计', exact: true }).click();
  const preferences = page.getByText('杯中的偏好', { exact: true }).locator('..').locator('..');
  await expect(preferences).not.toContainText('普通饮用水');
  await expect(page.getByRole('heading', { name: '拿铁咖啡', exact: true }).first()).toBeVisible();
  const record = page.getByRole('link', { name: '编辑 拿铁咖啡' }).first();
  await expect(record.locator('[class*="recordNutrients"]')).toBeVisible();
  await expect(record.locator('[class*="recordAction"]')).toContainText('查看详情');
});

test('records page provides one-tap favorites with undo, and search prioritizes packaged products', async ({ page }) => {
  await start(page);
  await choose(page, '美式咖啡');
  await page.getByRole('button', { name: '固定为常喝饮品' }).click();
  await expect(page.getByRole('button', { name: '已固定为常喝饮品' })).toBeDisabled();
  await page.goto('/records');
  const favorite = page.getByRole('button', { name: /美式咖啡/ }).filter({ has: page.locator('svg') }).first();
  await expect(page.getByRole('region', { name: '常喝饮品' })).toContainText('美式咖啡');
  await favorite.click();
  await expect(page.getByRole('status')).toContainText('已记入常喝饮品');
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('link', { name: '添加饮品', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索饮品' }).fill('百事');
  await expect(page.getByRole('heading', { name: '百事 · 百事可乐', exact: true })).toBeVisible();
  await expect(page.getByText('330 ml 罐装 · 商品预填 · 请核对标签', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '搜索饮品' }).fill('冰红茶');
  await expect(page.getByText('没有找到这杯饮品')).toBeVisible();
  await noOverflow(page);
});

test('new pages start at the top while back navigation restores the previous position', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit automation restores its own viewport asynchronously; Chromium covers the app-managed history position.');
  await start(page); await seed(page);
  await page.getByRole('link', { name: '记录', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 600 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const recordLink = page.locator('a[href^="/record/"]').last();
  await expect(recordLink).toBeAttached();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.waitForTimeout(100);
  const recordsScroll = await page.evaluate(() => window.scrollY);
  await page.evaluate(scroll => sessionStorage.setItem('cup-ledger:scroll:path:/records', String(scroll)), recordsScroll);
  await recordLink.click({ force: true });
  await expect(page).toHaveURL(/\/record\//);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('link', { name: '返回', exact: true }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await page.getByRole('link', { name: '统计', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('link', { name: '我的', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('link', { name: /饮品管理/ }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
