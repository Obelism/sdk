// The visual editor loads the site in an iframe at the environment's preview
// URL plus the entry's path, with these parameters added. `cms_token` is a
// token the CMS made for the person editing (`cms_v_…`): it reads drafts
// through the delivery API for 8 hours. Read drafts with it, never because
// `cms_preview` is there: anyone can add that to a URL.
export const PREVIEW_PARAMS = {
	preview: 'cms_preview',
	entry: 'cms_entry',
	environment: 'cms_environment',
	token: 'cms_token',
} as const

export type PreviewParams = {
	entryId: string | null
	environment: string | null
	// Null from a CMS that doesn't send one yet.
	token: string | null
}

type SearchParamsInput =
	| URL
	| URLSearchParams
	| string
	// Next.js `searchParams`, Express `req.query` and the like.
	| Record<string, string | string[] | undefined>

const toSearchParams = (input: SearchParamsInput) => {
	if (input instanceof URL) return input.searchParams
	if (input instanceof URLSearchParams) return input
	if (typeof input === 'string') {
		return input.includes('://')
			? new URL(input).searchParams
			: new URLSearchParams(input)
	}
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(input)) {
		if (value === undefined) continue
		for (const item of Array.isArray(value) ? value : [value]) {
			params.append(key, item)
		}
	}
	return params
}

// The editor's parameters when this is a preview request, else null.
//
//   const preview = readPreviewParams(request.url)
//   const content = preview?.token
//   	? new ContentClient({ token: preview.token, init: { cache: 'no-store' } })
//   	: deliveryClient
//
// A made-up or expired token makes the client throw a ContentApiError with
// status 401: answer with `deliveryClient` then.
export const readPreviewParams = (
	input: SearchParamsInput,
): PreviewParams | null => {
	const params = toSearchParams(input)
	if (!params.has(PREVIEW_PARAMS.preview)) return null
	return {
		entryId: params.get(PREVIEW_PARAMS.entry),
		environment: params.get(PREVIEW_PARAMS.environment),
		token: params.get(PREVIEW_PARAMS.token),
	}
}
