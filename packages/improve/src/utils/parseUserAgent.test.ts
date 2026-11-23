import { describe, expect, test } from 'vitest'

import { parseUserAgent } from './parseUserAgent'

describe('parseUserAgent', () => {
	test.each([
		[
			'Safari on macOS',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
			{ os: 'mac os', browser: 'safari', device: 'desktop' },
		],
		[
			'Chrome on macOS',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
			{ os: 'mac os', browser: 'chrome', device: 'desktop' },
		],
		[
			'Safari on iPhone',
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
			{ os: 'ios', browser: 'safari', device: 'mobile' },
		],
		[
			'Chrome on Android',
			'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
			{ os: 'android', browser: 'chrome', device: 'mobile' },
		],
		[
			'Edge on Windows',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
			{ os: 'windows', browser: 'edge', device: 'desktop' },
		],
		[
			'Firefox on Linux',
			'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
			{ os: 'unix', browser: 'firefox', device: 'desktop' },
		],
	])('%s', (_, userAgent, expected) => {
		expect(parseUserAgent(userAgent)).toMatchObject(expected)
	})
})
