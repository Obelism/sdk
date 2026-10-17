import type { Device } from './types'

// improve's audience categories from the user agent, the short version
// (improve's SDK uses ua-parser-js; pass its result as `device` to match it
// exactly).
export const detectDevice = (userAgent: string): Device => {
	const ua = userAgent.toLowerCase()
	const device = /ipad|tablet|android(?!.*mobile)/.test(ua)
		? 'tablet'
		: /mobi|iphone|ipod|android/.test(ua)
			? 'mobile'
			: 'desktop'
	const browser = /edg\//.test(ua)
		? 'edge'
		: /samsungbrowser/.test(ua)
			? 'samsung internet'
			: /instagram|fban|fbav|tiktok|snapchat|wechat|line\//.test(ua)
				? 'social'
				: /firefox|fxios/.test(ua)
					? 'firefox'
					: /chrome|crios|chromium/.test(ua)
						? 'chrome'
						: /safari/.test(ua)
							? 'safari'
							: 'other'
	const os = /iphone|ipad|ipod/.test(ua)
		? 'ios'
		: /android/.test(ua)
			? 'android'
			: /windows/.test(ua)
				? 'windows'
				: /mac os/.test(ua)
					? 'mac os'
					: 'unix'
	return {
		pointer: device === 'desktop' ? 'fine' : 'coarse',
		device,
		browser,
		os,
	}
}

export const getScreenSize = () => {
	const width = window.innerWidth
	if (width <= 768) return 'small'
	if (width <= 1024) return 'medium'
	if (width <= 1200) return 'large'
	return 'huge'
}
