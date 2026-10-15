// The visual editor loads the site in an iframe at the environment's preview
// URL plus the entry's path, with these parameters added. A request carrying
// `cms_preview` should be answered with drafts: fetch with a preview token.
export const PREVIEW_PARAMS = {
	preview: 'cms_preview',
	entry: 'cms_entry',
	environment: 'cms_environment',
} as const

export type PreviewParams = {
	entryId: string | null
	environment: string | null
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
//   const content = preview ? previewClient : deliveryClient
export const readPreviewParams = (
	input: SearchParamsInput,
): PreviewParams | null => {
	const params = toSearchParams(input)
	if (!params.has(PREVIEW_PARAMS.preview)) return null
	return {
		entryId: params.get(PREVIEW_PARAMS.entry),
		environment: params.get(PREVIEW_PARAMS.environment),
	}
}
