import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	timeout: 60_000,
	fullyParallel: false,
	reporter: [['list']],
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'off',
		screenshot: 'on'
	},
	projects: [
		{
			name: 'mobile',
			use: {
				browserName: 'chromium',
				viewport: { width: 390, height: 844 },
				deviceScaleFactor: 2,
				hasTouch: true,
				isMobile: true,
				userAgent:
					'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1'
			}
		},
		{
			name: 'tablet',
			use: {
				browserName: 'chromium',
				viewport: { width: 820, height: 1180 },
				deviceScaleFactor: 2,
				hasTouch: true
			}
		},
		{
			name: 'desktop',
			use: {
				browserName: 'chromium',
				viewport: { width: 1440, height: 900 }
			}
		}
	],
	webServer: {
		command: 'pnpm dev',
		url: 'http://localhost:5173',
		reuseExistingServer: true,
		timeout: 60_000
	}
});
