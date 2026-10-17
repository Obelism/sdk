import { createNumbers, type NumbersClient } from './client'
import type { Environment } from './types'

// The client as one script tag, for sites without a bundler. numbers serves
// this build as its /script.js (it replaced a hand-written script); npm CDNs
// serve it from dist/script.global.js:
//
//   <script defer src="https://numbers.obelism.studio/script.js"
//     data-organization="org_…" data-environment="production"></script>
//
// It sends page views and clicks on tagged elements, and puts the client on
// `window.numbers` (`numbers.track('sign_up', 'footer_form')`). Events go to
// the origin the script came from, or `data-endpoint`.

export type ScriptWindow = Window & { numbers?: NumbersClient }

export const startScript = (
	target: ScriptWindow,
	script: HTMLScriptElement | null,
) => {
	if (!script || target.numbers) return null
	const organizationId = script.dataset.organization
	if (!organizationId) return null
	const numbers = createNumbers({
		organizationId,
		environment: (script.dataset.environment || 'production') as Environment,
		endpoint:
			script.dataset.endpoint ||
			new URL('/api/log', script.src || location.href).href,
		disableWarnings: true,
	})
	target.numbers = numbers
	numbers.autoTrack()
	return numbers
}
