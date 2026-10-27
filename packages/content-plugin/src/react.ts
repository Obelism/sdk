import { useEffect, useState } from 'react'

import {
	connect,
	type ConnectOptions,
	type Plugin,
	type PluginContext,
} from './index'

// The plugin and its context, kept current: null until Content connects.
export const usePlugin = (options?: ConnectOptions) => {
	const [plugin, setPlugin] = useState<Plugin | null>(null)
	const [context, setContext] = useState<PluginContext | null>(null)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		let connected: Plugin | null = null
		let cancelled = false
		const unsubscribe: (() => void)[] = []
		connect(options)
			.then((next) => {
				if (cancelled) return next.disconnect()
				connected = next
				const sync = () => setContext({ ...next.context })
				unsubscribe.push(
					next.onContext(sync),
					next.onValue(sync),
					next.onEntry(sync),
				)
				setPlugin(next)
				sync()
			})
			.catch((reason: unknown) => {
				if (!cancelled) setError(reason as Error)
			})
		return () => {
			cancelled = true
			for (const stop of unsubscribe) stop()
			connected?.disconnect()
		}
		// Connects once; options are read on mount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return { plugin, context, error }
}
