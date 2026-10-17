const EXTENDED_BOT_REGEX = new RegExp(
	[
		'Vercelbot',
		'DotBot',
		'Yeti',
		'AhrefsBot',
		'SeznamBot',
		'YandexBot',
		'UptimeRobot',
		'Bytespider',
		'Baiduspider',
		'fidget-spinner-bot',
		'AASA-Bot',
		'FullStoryBot',
		'SemrushBot',
		'PetalBot',
		'RyteBot',
		'Pinterestbot',
		'AntBot',
		'Monsidobot',
		'blowra',
		'JobRoboter',
		'Qwantify',
		'YisouSpider',
	]
		.map((name) => name.toLowerCase())
		.join('|'),
	'i',
)

export const extendedBotCheck = (userAgent: string): boolean => {
	if (!userAgent) return false
	return EXTENDED_BOT_REGEX.test(userAgent.toLowerCase())
}
