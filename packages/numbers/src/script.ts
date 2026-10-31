import { createNumbers, type NumbersClient } from './client'
import { DEFAULT_ENDPOINT } from './constants'
import type { Environment } from './types'
import type { VisitorStorage } from './visitor'

// The client as one script tag, for sites without a bundler. numbers serves
// this build as its /script.js (it replaced a hand-written script); npm CDNs
// serve it from dist/script.global.js:
//
//   <script defer src="https://numbers.obelism.studio/script.js"
//     data-organization="org_…" data-space="space_…"
//     data-environment="production"></script>
//
// `data-space` is optional: without it, the organization's first space.
//
// It sends page views and clicks on tagged elements, and puts the client on
// `window.numbers` (`numbers.track('sign_up', 'footer_form')`). Events go to
// numbers' origin, or `data-endpoint`; `data-debug` turns on the client's
// development warnings, and `data-storage="session|none"` counts without a
// cookie.

export type ScriptWindow = Window & { numbers?: NumbersClient }

const NUMBERS_HOST = 'numbers.obelism.studio'

// A CDN serves the same file from its own host, where /api/log doesn't exist.
// Only numbers itself (or a local numbers while developing) is the endpoint;
// anything else uses numbers' origin, unless `data-endpoint` says otherwise.
export const resolveEndpoint = (src: string) => {
	try {
		const url = new URL(src)
		const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
		if (url.hostname === NUMBERS_HOST || local) return `${url.origin}/api/log`
	} catch {
		// No usable src: numbers' own endpoint.
	}
	return DEFAULT_ENDPOINT
}

const storageOf = (value: string | undefined): VisitorStorage =>
	value === 'session' || value === 'none' ? value : 'cookie'

export const startScript = (
	target: ScriptWindow,
	script: HTMLScriptElement | null,
) => {
	if (!script || target.numbers) return null
	const organizationId = script.dataset.organization
	if (!organizationId) return null

	const debug = script.dataset.debug !== undefined
	const warn = (message: string) => {
		if (debug && typeof console !== 'undefined')
			console.warn(`[numbers] ${message}`)
	}

	const givenSpace = script.dataset.space
	const spaceId =
		givenSpace && givenSpace.startsWith('space_') ? givenSpace : undefined
	if (givenSpace && !spaceId)
		warn(`data-space "${givenSpace}" is not a space_… id and will be ignored.`)

	const numbers = createNumbers({
		organizationId,
		spaceId,
		environment: (script.dataset.environment || 'production') as Environment,
		endpoint: script.dataset.endpoint || resolveEndpoint(script.src),
		disableWarnings: !debug,
		storage: storageOf(script.dataset.storage),
	})
	target.numbers = numbers
	numbers.autoTrack()
	return numbers
}
