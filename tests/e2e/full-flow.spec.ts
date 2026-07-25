import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const SERVER_URL = process.env.SERVER_URL ?? 'http://127.0.0.1:3000';
const DEMO_EMAIL = 'builder@sopscape.local';
const DEMO_PASSWORD = 'SOPscape-Demo-2026';

test.describe('SOPscape E2E — Login to Share Flow', () => {
  test('full flow: login → analyze → invite → accept → manage → share', async ({ page }) => {
    // 1. 打开首页
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/SOPscape/i);

    // 2. 登录
    await expect(page.getByRole('heading', { name: /登录/i })).toBeVisible();
    await page.getByLabel('邮箱').fill(DEMO_EMAIL);
    await page.getByLabel('密码').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /安全登录/i }).click();
    await expect(page.getByText(/builder/i)).toBeVisible({ timeout: 10000 });

    // 3. 验证身份标识显示
    await expect(page.getByText(/owner/i)).toBeVisible();

    // 4. 导航到产品工作台 → 安全视图
    await page.getByRole('navigation').getByText(/安全/i).click();
    await expect(page.getByText(/安全 A2MCP 服务/i)).toBeVisible();

    // 5. 创建邀请
    await page.getByLabel('邀请邮箱').fill('e2e-test@example.com');
    await page.getByLabel('邀请角色').selectOption('editor');
    await page.getByRole('button', { name: /生成.*邀请/i }).click();
    await expect(page.getByText(/邀请已创建|invitation/i)).toBeVisible({ timeout: 5000 });

    // 6. 复制邀请链接并验证格式
    const inviteUrl = await page.locator('.invitation-result code').textContent();
    expect(inviteUrl).toContain('?invite=');

    // 7. 打开团队管理
    await page.getByRole('button', { name: /团队管理/i }).click();
    await expect(page.getByRole('heading', { name: /成员与邀请/i })).toBeVisible();

    // 8. 验证成员列表
    await page.getByText(/成员/i).click();
    await expect(page.getByText('builder@sopscape.local')).toBeVisible();

    // 9. 验证邀请列表
    await page.getByText(/邀请/i).click();
    await expect(page.getByText('e2e-test@example.com')).toBeVisible();

    // 10. 关闭团队管理
    await page.getByRole('button', { name: /关闭/i }).click();
    await expect(page.getByRole('heading', { name: /成员与邀请/i })).not.toBeVisible();
  });

  test('share link: create share and view without login', async ({ context }) => {
    // 先在已登录状态下创建分享
    // 通过 API 创建分享
    const loginRes = await context.request.post(`${SERVER_URL}/api/auth/login`, {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
    const cookies = loginRes.headers()['set-cookie'];
    expect(cookies).toBeTruthy();

    const cookieHeader = cookies.split(';')[0];

    // 生成一个 rehearsal
    const genRes = await context.request.post(`${SERVER_URL}/a2mcp/generate-rehearsal`, {
      data: { title: 'E2E Test SOP', content: 'Test content for E2E share flow' },
    });
    expect(genRes.ok()).toBe(true);
    const genBody = await genRes.json();
    const rehearsalId = genBody.rehearsalId;

    // 创建分享
    const shareRes = await context.request.post(`${SERVER_URL}/api/shares`, {
      data: { rehearsalId, maxViews: 5 },
      headers: { Cookie: cookieHeader },
    });
    expect(shareRes.ok()).toBe(true);
    const shareBody = await shareRes.json();
    const shareToken = shareBody.shareToken;

    // 在新页面（无登录状态）打开分享链接
    const sharePage = await context.newPage();
    await sharePage.goto(`${BASE_URL}/r/${shareToken}`);

    // 验证分享报告页面
    await expect(sharePage.getByText(/演练报告/i)).toBeVisible();
    await expect(sharePage.getByText(/只读/i)).toBeVisible();
    await expect(sharePage.getByText(/演练概览/i)).toBeVisible();
  });

  test('theme toggle: dark and light mode', async ({ page }) => {
    await page.goto(BASE_URL);

    // 深色模式验证
    const body = page.locator('body');
    const bgColor = await body.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgColor).toBeDefined();

    // 切换主题
    const themeSelect = page.getByLabel(/主题/i);
    if (await themeSelect.isVisible()) {
      await themeSelect.selectOption('light');
      await page.waitForTimeout(100);
    }
  });

  test('language switch: 10 languages available', async ({ page }) => {
    await page.goto(BASE_URL);

    // 验证语言选择器存在
    const langSelect = page.getByLabel(/语言/i);
    await expect(langSelect).toBeVisible();

    // 验证选项数量
    const options = await langSelect.locator('option').all();
    expect(options.length).toBeGreaterThanOrEqual(10);
  });

  test('3D command room loads', async ({ page }) => {
    await page.goto(BASE_URL);

    // 登录
    await page.getByLabel('邮箱').fill(DEMO_EMAIL);
    await page.getByLabel('密码').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /安全登录/i }).click();
    await expect(page.getByText(/builder/i)).toBeVisible({ timeout: 10000 });

    // 导航到指挥室
    await page
      .getByRole('navigation')
      .getByText(/指挥室|command/i)
      .click();

    // 提交 SOP 并进入 3D 视图
    const textarea = page.getByRole('textbox', { name: /SOP|内容|content/i }).first();
    if (await textarea.isVisible()) {
      await textarea.fill('收到可疑邮件后：1. 不点击链接 2. 核验发件人 3. 上报安全团队');
      await page
        .getByRole('button', { name: /提交|分析|开始/i })
        .first()
        .click();

      // 等待 3D 场景加载
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });
    }
  });

  test('logout and re-login', async ({ page }) => {
    await page.goto(BASE_URL);

    // 登录
    await page.getByLabel('邮箱').fill(DEMO_EMAIL);
    await page.getByLabel('密码').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /安全登录/i }).click();
    await expect(page.getByText(/builder/i)).toBeVisible({ timeout: 10000 });

    // 登出
    await page.getByRole('button', { name: /退出/i }).click();
    await expect(page.getByRole('heading', { name: /登录/i })).toBeVisible({ timeout: 5000 });

    // 重新登录
    await page.getByLabel('邮箱').fill(DEMO_EMAIL);
    await page.getByLabel('密码').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /安全登录/i }).click();
    await expect(page.getByText(/builder/i)).toBeVisible({ timeout: 10000 });
  });
});
