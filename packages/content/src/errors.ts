// A response from the API that wasn't a success. `message` is the API's own
// `error` text when it sent one.
export class ContentApiError extends Error {
	readonly status: number
	readonly url: string
	readonly body: unknown

	constructor(status: number, url: string, body: unknown) {
		const apiMessage =
			typeof body === 'object' &&
			body !== null &&
			typeof (body as { error?: unknown }).error === 'string'
				? (body as { error: string }).error
				: null
		super(apiMessage ?? `Obelism Content answered ${status} for ${url}`)
		this.name = 'ContentApiError'
		this.status = status
		this.url = url
		this.body = body
	}
}
