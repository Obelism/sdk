import { UAParser } from 'ua-parser-js'

import {
	AUDIENCE_PARAMS,
	AudienceParamBrowser,
	AudienceParamDevice,
	AudienceParamOs,
	AudienceParamPointer,
} from '../config/audiences'

export type ParsedUserAgent = {
	pointer: AudienceParamPointer
	device: AudienceParamDevice
	browser: AudienceParamBrowser
	os: AudienceParamOs
	// Coarse geo, not derived from the user agent — merged in server-side
	// (SSR/middleware) so audiences can target by country. Absent client-side.
	country?: string
}

const formatDeviceType = (deviceType?: string): AudienceParamDevice => {
	if (
		deviceType &&
		AUDIENCE_PARAMS.device.includes(deviceType as AudienceParamDevice)
	) {
		return deviceType as AudienceParamDevice
	}
	return 'desktop'
}

const SOCIAL_BROWSERS: ReadonlyArray<string> = [
	'tiktok',
	'wechat',
	'weibo',
	'snapchat',
	'klarna',
	'Line',
	'instagram',
	'facebook',
	'alipay',
	'Baidu',
]

const formatBrowser = (browserName: string = ''): AudienceParamBrowser => {
	if (!browserName) return 'other'

	const name = browserName.toLowerCase()

	const browserTypeMatch = AUDIENCE_PARAMS.browser.find((browserType) => {
		return name.includes(browserType)
	})

	if (browserTypeMatch) return browserTypeMatch

	if (SOCIAL_BROWSERS.includes(name)) return 'social'
	return 'other'
}

const PRIMARY_TOUCH_DEVICES: ReadonlyArray<AudienceParamDevice> = [
	'wearable',
	'mobile',
	'tablet',
]

const formatPointer = (device: AudienceParamDevice) => {
	return PRIMARY_TOUCH_DEVICES.includes(device) ? 'coarse' : 'fine'
}

const formatOs = (osName: string = ''): AudienceParamOs => {
	if (!osName) return 'unix'

	const os = osName.toLowerCase()

	const osTypeMatch = AUDIENCE_PARAMS.os.find((osType) => {
		return os.includes(osType)
	})

	if (osTypeMatch) return osTypeMatch
	return 'unix'
}

export const parseUserAgent = (userAgent: string): ParsedUserAgent | null => {
	if (!userAgent || typeof userAgent !== 'string') return null

	const parser = new UAParser(userAgent)
	const results = parser.getResult()

	const device = formatDeviceType(results.device.type)

	return {
		pointer: formatPointer(device),
		device: device,
		browser: formatBrowser(results.browser.name),
		os: formatOs(results.os.name),
	}
}
