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
// `url` and `DEFAULT_ENDPOINT` stay in one scope: a `let` in the try block
// made the script minifier shadow the constant and return the URL object.
const resolveEndpoint = (src: string) => {
	let url: URL | undefined
	try {
		url = new URL(src)
	} catch {
		return DEFAULT_ENDPOINT
	}
	const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
	if (url.hostname === NUMBERS_HOST || local) return `${url.origin}/api/log`
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
	if (givenSpace && !spaceId && typeof console !== 'undefined')
		console.warn(
			`[numbers] data-space "${givenSpace}" is not a space_… id and will be ignored.`,
		)

	const givenStorage = script.dataset.storage
	if (givenStorage && givenStorage !== 'session' && givenStorage !== 'none')
		warn(
			`data-storage "${givenStorage}" is not "session" or "none"; using a cookie.`,
		)

	const numbers = createNumbers({
		organizationId,
		spaceId,
		environment: (script.dataset.environment || 'production') as Environment,
		endpoint: script.dataset.endpoint || resolveEndpoint(script.src),
		disableWarnings: !debug,
		storage: storageOf(givenStorage),
	})
	target.numbers = numbers
	numbers.autoTrack()
	return numbers
}
