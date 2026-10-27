// The plugin side of Obelism Content's plugin protocol, version 1 (Content's
// docs/adr/0027). Content frames the plugin's page, posts
// `{ type: 'obelism:init', protocol: 1 }` with a MessagePort once, from its
// own origin, and everything after goes over that port.

export const PROTOCOL = 1

export type PluginLocation = 'field' | 'page'

export type PluginContext = {
	location: PluginLocation
	pluginId: string
	// The environment's settings for the plugin, from its manifest's config.
	config: Record<string, string | number | boolean>
	// For a field: the field, this field's own settings, and its value in
	// `locale`.
	field?: { apiId: string; name: string; type: string; localized: boolean }
	fieldConfig?: Record<string, unknown>
	value?: unknown
	locale?: string
	locales?: { code: string; name: string }[]
	readOnly: boolean
	space: { spaceId: string; name: string }
	environment: string
	theme: 'light' | 'dark'
	// With the `entry:read` permission.
	entry?: PluginEntry
	// With the `user` permission.
	user?: { id: string; name: string | null; role: string }
}

export type PluginEntry = {
	entryId: string
	contentType: string | null
	draft: Record<string, unknown>
}

export type ToastTone = 'neutral' | 'positive' | 'negative'

export type Plugin = {
	readonly context: PluginContext
	// A field's new value: an unsaved change the editor reviews and saves.
	// JSON, up to 1 MB. Ignored while read-only.
	setValue: (value: unknown) => void
	// The frame's height in pixels (0–4000). connect() keeps it in step
	// with the page's own unless `autoHeight: false`.
	setHeight: (height: number) => void
	openLink: (url: string) => void
	toast: (message: string, tone?: ToastTone) => void
	// A five-minute token for the plugin's backend, with the `token`
	// permission (verify it with @obelism/content-plugin/server).
	token: () => Promise<{ token: string; expiresAt: string }>
	// The value changed in the form (another language, undo, a restore).
	onValue: (listener: (value: unknown) => void) => () => void
	// The entry changed, with `entry:read`.
	onEntry: (listener: (entry: PluginEntry) => void) => () => void
	// The context changed (the language, read-only).
	onContext: (listener: (context: PluginContext) => void) => () => void
	disconnect: () => void
}

export type ConnectOptions = {
	// Content's origin; `obelism:init` from any other origin, or from a
	// window other than the frame's parent, is ignored. Pass
	// `http://localhost:8789` to build against a local Content.
	origin?: string
	autoHeight?: boolean
	timeout?: number
	window?: Window
}

export const CONTENT_ORIGIN = 'https://content.obelism.studio'

type HostMessage =
	| ({ type: 'context' } & PluginContext)
	| { type: 'value'; value: unknown }
	| { type: 'entry'; entry: PluginEntry }
	| { type: 'token'; id: string; token: string; expiresAt: string }
	| { type: 'error'; id?: string; message: string }

const listeners = <T>() => {
	const set = new Set<(value: T) => void>()
	return {
		add: (listener: (value: T) => void) => {
			set.add(listener)
			return () => {
				set.delete(listener)
			}
		},
		emit: (value: T) => {
			for (const listener of set) listener(value)
		},
	}
}

// Waits for Content's `obelism:init`, says `ready`, and resolves once the
// context arrives.
export const connect = (options: ConnectOptions = {}): Promise<Plugin> => {
	const target = options.window ?? window
	const origin = options.origin ?? CONTENT_ORIGIN
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			target.removeEventListener('message', onInit)
			reject(new Error('Content never connected: is this page in its frame?'))
		}, options.timeout ?? 10_000)

		const onInit = (event: MessageEvent) => {
			if (event.origin !== origin || event.source !== target.parent) return
			const data = event.data as { type?: unknown; protocol?: unknown }
			if (data?.type !== 'obelism:init' || data.protocol !== PROTOCOL) return
			const port = event.ports[0]
			if (!port) return
			target.removeEventListener('message', onInit)
			clearTimeout(timer)
			resolve(open(port, target, options.autoHeight !== false))
		}
		target.addEventListener('message', onInit)
	}).then((plugin) => plugin as Plugin)
}

const open = (port: MessagePort, target: Window, autoHeight: boolean) =>
	new Promise<Plugin>((resolve) => {
		const value = listeners<unknown>()
		const entry = listeners<PluginEntry>()
		const contextChanged = listeners<PluginContext>()
		const pending = new Map<
			string,
			{
				resolve: (token: { token: string; expiresAt: string }) => void
				reject: (error: Error) => void
			}
		>()
		let context: PluginContext | null = null
		let observer: ResizeObserver | undefined
		const send = (message: unknown) => port.postMessage(message)

		const plugin: Plugin = {
			get context() {
				return context!
			},
			setValue: (next) => send({ type: 'setValue', value: next }),
			setHeight: (height) => send({ type: 'height', height }),
			openLink: (url) => send({ type: 'openLink', url }),
			toast: (message, tone = 'neutral') =>
				send({ type: 'toast', message, tone }),
			token: () =>
				new Promise((resolveToken, rejectToken) => {
					const id = Math.random().toString(36).slice(2)
					pending.set(id, { resolve: resolveToken, reject: rejectToken })
					send({ type: 'token', id })
				}),
			onValue: value.add,
			onEntry: entry.add,
			onContext: contextChanged.add,
			disconnect: () => {
				observer?.disconnect()
				port.close()
			},
		}

		port.onmessage = ({ data }: MessageEvent<HostMessage>) => {
			switch (data?.type) {
				case 'context': {
					const { type: _, ...next } = data
					const first = context === null
					context = next
					if (first) resolve(plugin)
					else contextChanged.emit(next)
					return
				}
				case 'value':
					if (context) context = { ...context, value: data.value }
					value.emit(data.value)
					return
				case 'entry':
					if (context) context = { ...context, entry: data.entry }
					entry.emit(data.entry)
					return
				case 'token':
					pending.get(data.id)?.resolve({
						token: data.token,
						expiresAt: data.expiresAt,
					})
					pending.delete(data.id)
					return
				case 'error':
					if (data.id) {
						pending.get(data.id)?.reject(new Error(data.message))
						pending.delete(data.id)
					}
			}
		}
		port.start()

		if (autoHeight && typeof ResizeObserver !== 'undefined') {
			const body = target.document.documentElement
			observer = new ResizeObserver(() =>
				plugin.setHeight(Math.ceil(body.scrollHeight)),
			)
			observer.observe(body)
		}
		send({ type: 'ready' })
	})

// A manifest's JSON Schema, for an editor to check one as it is written.
export const MANIFEST_SCHEMA = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	title: 'Obelism Content plugin manifest',
	type: 'object',
	required: ['id', 'name', 'url', 'locations'],
	properties: {
		id: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,62}$' },
		name: { type: 'string', minLength: 1, maxLength: 64 },
		url: { type: 'string', format: 'uri', pattern: '^https://' },
		locations: {
			type: 'array',
			minItems: 1,
			items: {
				oneOf: [
					{
						type: 'object',
						required: ['type', 'fieldTypes'],
						properties: {
							type: { const: 'field' },
							fieldTypes: {
								type: 'array',
								minItems: 1,
								items: {
									enum: [
										'text',
										'textarea',
										'richtext',
										'number',
										'boolean',
										'datetime',
										'select',
										'asset',
										'reference',
										'link',
										'shopify',
										'json',
									],
								},
							},
						},
					},
					{
						type: 'object',
						required: ['type', 'title'],
						properties: {
							type: { const: 'page' },
							title: { type: 'string', minLength: 1, maxLength: 64 },
						},
					},
				],
			},
		},
		permissions: {
			type: 'array',
			items: { enum: ['entry:read', 'user', 'token'] },
		},
		config: {
			type: 'object',
			required: ['type', 'properties'],
			properties: {
				type: { const: 'object' },
				properties: {
					type: 'object',
					additionalProperties: {
						type: 'object',
						required: ['type'],
						properties: {
							type: { enum: ['string', 'number', 'boolean'] },
							title: { type: 'string' },
							description: { type: 'string' },
							enum: { type: 'array', items: { type: 'string' } },
						},
					},
				},
				required: { type: 'array', items: { type: 'string' } },
			},
		},
	},
} as const
