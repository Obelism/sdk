type Route = { pattern: string; segments: string[] }

const isParam = (segment: string) =>
	segment.length > 2 && segment.startsWith('[') && segment.endsWith(']')

// Left to right, a static segment beats a parameter, so `/organization/create`
// wins over `/organization/[organizationId]` when both are listed.
const moreSpecific = (a: Route, b: Route) => {
	for (let i = 0; i < a.segments.length; i++) {
		const aParam = isParam(a.segments[i]!)
		if (aParam !== isParam(b.segments[i]!)) return !aParam
	}
	return false
}

/**
 * Turns route patterns (`/tests/[testId]`) into a function that reports a
 * path as the pattern it matches, so ids in a URL don't make every record its
 * own page. A `[name]` segment matches one non-empty segment; a path matching
 * no pattern stays as it is.
 */
export const routePath = (
	patterns: readonly string[] | undefined,
): ((path: string) => string) => {
	const routes: Route[] = []
	for (const pattern of patterns ?? []) {
		const trimmed = pattern.trim()
		if (trimmed.startsWith('/'))
			routes.push({ pattern: trimmed, segments: trimmed.split('/') })
	}
	if (!routes.length) return (path) => path

	return (path) => {
		const segments = path.split('/')
		let best: Route | undefined
		for (const route of routes) {
			if (route.segments.length !== segments.length) continue
			const matches = route.segments.every((segment, i) =>
				isParam(segment) ? segments[i] !== '' : segment === segments[i],
			)
			if (matches && (!best || moreSpecific(route, best))) best = route
		}
		return best ? best.pattern : path
	}
}
