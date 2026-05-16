import { test, expect } from '@playwright/test';

test.describe('Playwright E2E 冒烟验证', () => {

  test('健康检查端点可访问', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('未认证请求返回 401', async ({ request }) => {
    const res = await request.get('/protected');
    expect(res.status()).toBe(401);
  });

  test('携带正确 API Key 返回 200', async ({ request }) => {
    const res = await request.get('/protected', {
      headers: { 'x-api-key': 'smoke-test-key' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ ok: true, message: 'authorized' });
  });

  test('错误 API Key 返回 401', async ({ request }) => {
    const res = await request.get('/protected', {
      headers: { 'x-api-key': 'wrong-key' },
    });
    expect(res.status()).toBe(401);
  });

  test('浏览器能打开健康检查页面', async ({ page }) => {
    await page.goto('/health');
    // Express JSON 响应在浏览器中以文本形式展示
    await expect(page.locator('body')).toContainText('ok');
  });

});
