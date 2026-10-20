import { getEvents } from '@obelism/events-sdk'

import { createNumbers, type NumbersClient } from './client'
import type { Environment } from './types'

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
// It subscribes to the page's events SDK bus (`window.obelismEvents`, made
// here when nothing made it before) and has the bus emit page views and
// clicks on tagged elements, so sites publish with
// `obelismEvents.emit('sign_up', { scope: 'footer_form' })` and every
// tracker on the bus gets it. The client itself is on `window.numbers`.
// Events go to the origin the script came from, or `data-endpoint`.

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
		spaceId: script.dataset.space || undefined,
		environment: (script.dataset.environment || 'production') as Environment,
		endpoint:
			script.dataset.endpoint ||
			new URL('/api/log', script.src || location.href).href,
		disableWarnings: true,
	})
	target.numbers = numbers
	const events = getEvents()
	numbers.connect(events)
	events.autoTrack()
	return numbers
}
