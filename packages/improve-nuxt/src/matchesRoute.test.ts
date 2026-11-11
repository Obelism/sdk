import { expect, test } from 'vitest'

import { matchesRoute } from './matchesRoute'

type RouteAndPathname = [string, string]

const MATCHES: RouteAndPathname[] = [
	['/cake', '/cake'],
	['/cake', '/cake/'],
	['/cake', '/cake?frige=warm'],
	['/cake', '/cake?frige=warm&freezer=cold'],
	['/[id]', '/cake'],
	['/[anything-goes]', '/cake'],
	['/c/[id]/practitioner/[pid]/[anything-goes]', '/c/1/practitioner/2/3'],
	['/[...rest]', '/cake'],
	['/[...rest]', '/cake/fake/snake?shake=true'],
	['/shop/[[...rest]]', '/shop'],
	['/shop/[[...rest]]', '/shop/'],
	['/shop/[[...rest]]', '/shop/snake'],
	['/[...rest]/fake/snake', '/cake/fake/snake?shake=true'],
	['/welcome', '/welcome/?verifier=z3vvsSm'],
] as const

const NON_MATCHES: RouteAndPathname[] = [
	['/stake', '/snake'],
	['/cake', '/cake/subpath-not-ok'],
	['/cake/[oh-whats-this]', '/cake/'],
	['/[...rest]/nope/snake', '/cake/fake/snake?shake=true'],
	['/[...rest]', '/'],
] as const

MATCHES.forEach(([route, pathname]) => {
	test(`matches ${pathname} to ${route}`, () => {
		expect(matchesRoute(route, pathname)).toEqual(true)
	})
})

NON_MATCHES.forEach(([route, pathname]) => {
	test(`does not match ${pathname} to ${route}`, () => {
		expect(matchesRoute(route, pathname)).toEqual(false)
	})
})
