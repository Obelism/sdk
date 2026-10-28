import { createNumbers, type Environment } from '@obelism/numbers-sdk'
import { useEffect } from 'react'

export function NumbersTracker({
	organizationId,
	spaceId,
	environment,
}: {
	organizationId: string
	spaceId?: string | undefined
	environment: Environment
}) {
	useEffect(() => {
		if (!organizationId) return
		// The hosted script sends to the organization's first space; the SDK
		// takes this storefront's space, and tracks page views on every history
		// change just the same.
		const numbers = createNumbers({ organizationId, spaceId, environment })
		return numbers.autoTrack()
	}, [organizationId, spaceId, environment])

	return null
}
