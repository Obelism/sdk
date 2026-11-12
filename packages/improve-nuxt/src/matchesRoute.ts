const BASE_REGEX = /(\[[a-zA-Z0-9-]+\])+/g

const SECONDARY_REGEX = /\[\[\.\.\.[a-zA-Z0-9-]+\]\]/g

const TERTIARY_REGEX = /\[\.\.\.[a-zA-Z0-9-]+\]/g

export const removeTrailingSlash = (val: string) =>
	val.endsWith('/') ? val.substring(0, val.length - 1) : val

const regexCache = new Map<string, RegExp>()

export const matchesRoute = (route: string, pathname: string) => {
	const basePathname = removeTrailingSlash(pathname.split('?')[0] as string)
	const baseRoute = removeTrailingSlash(route.split('?')[0] as string)

	if (basePathname === baseRoute) return true

	let routeRegex = regexCache.get(baseRoute)
	if (!routeRegex) {
		routeRegex = new RegExp(
			`^${baseRoute.replace(BASE_REGEX, '[a-zA-Z0-9-]+')}$`
				.replace(SECONDARY_REGEX, '?.*')
				.replace(TERTIARY_REGEX, '.*'),
		)
		regexCache.set(baseRoute, routeRegex)
	}

	return routeRegex.test(basePathname)
}
