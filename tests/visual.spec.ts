import { expect, test } from '@playwright/test';

async function settle(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');
	await page.waitForSelector('.maplibregl-canvas', { state: 'attached', timeout: 30_000 });
	await page.waitForTimeout(2_500);
}

test('cold open', async ({ page }, testInfo) => {
	await settle(page);
	await expect(page.locator('.maplibregl-canvas')).toBeVisible();
	await testInfo.attach(`cold-open-${testInfo.project.name}`, {
		body: await page.screenshot({ fullPage: false }),
		contentType: 'image/png'
	});
});

test('sheet expanded', async ({ page, viewport }, testInfo) => {
	await settle(page);
	const isMobileLayout = (viewport?.width ?? 1440) < 880;
	if (isMobileLayout) {
		const grab = page.getByRole('slider', { name: /hauteur/i });
		await grab.focus();
		await page.keyboard.press('ArrowUp');
		await page.keyboard.press('ArrowUp');
		await page.waitForTimeout(400);
	}
	await testInfo.attach(`sheet-${testInfo.project.name}`, {
		body: await page.screenshot({ fullPage: false }),
		contentType: 'image/png'
	});
});

test('line drill', async ({ page, viewport }, testInfo) => {
	await settle(page);
	const isMobileLayout = (viewport?.width ?? 1440) < 880;
	if (isMobileLayout) {
		const grab = page.getByRole('slider', { name: /hauteur/i });
		await grab.focus();
		await page.keyboard.press('ArrowUp');
		await page.waitForTimeout(300);
	}
	const firstRow = page.locator('section button.row').first();
	if ((await firstRow.count()) === 0) {
		test.skip(true, 'No lines loaded; STAR API likely unreachable.');
	}
	await firstRow.click();
	await page.waitForTimeout(500);
	await testInfo.attach(`drill-${testInfo.project.name}`, {
		body: await page.screenshot({ fullPage: false }),
		contentType: 'image/png'
	});
});
