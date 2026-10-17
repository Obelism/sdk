import type { Asset } from './types'

export type ImageTransform = {
	// Pixels, up to 3840.
	w?: number | undefined
	h?: number | undefined
	fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad' | undefined
	// `auto` (the API's default) picks AVIF or WebP when the browser takes them.
	format?: 'auto' | 'avif' | 'webp' | 'jpeg' | 'png' | undefined
	// Quality, 1–100 (the API's default is 80).
	q?: number | undefined
	// What `cover` and `crop` keep in view: `{ x, y }` (0–1 from the top left)
	// or `auto`. Default: the asset's focal point, when it has one.
	focus?: { x: number; y: number } | 'auto' | undefined
}

const KEYS = ['w', 'h', 'fit', 'format', 'q'] as const

const CROPS = new Set(['cover', 'crop'])

// An asset's URL with a resize / re-encode query. PNG, JPEG, GIF, WebP and
// AVIF are transformed; other files ignore the query.
//
//   imageUrl(asset, { w: 800 })
//   imageUrl(asset, { w: 800, h: 800, fit: 'cover' }) // around its focal point
export const imageUrl = (
	asset: (Pick<Asset, 'url'> & Partial<Pick<Asset, 'focalPoint'>>) | string,
	transform: ImageTransform = {},
) => {
	const url = new URL(typeof asset === 'string' ? asset : asset.url)
	for (const key of KEYS) {
		const value = transform[key]
		if (value !== undefined) url.searchParams.set(key, String(value))
	}
	const focus =
		transform.focus ??
		(typeof asset === 'string' ? undefined : (asset.focalPoint ?? undefined))
	if (focus && CROPS.has(transform.fit ?? '')) {
		url.searchParams.set(
			'focus',
			focus === 'auto' ? 'auto' : `${focus.x},${focus.y}`,
		)
	}
	return url.toString()
}

// A `srcset` with one candidate per width.
//
//   <img src={imageUrl(asset, { w: 960 })}
//        srcSet={imageSrcSet(asset, [480, 960, 1440])}
//        sizes="(min-width: 60rem) 50vw, 100vw" />
export const imageSrcSet = (
	asset: (Pick<Asset, 'url'> & Partial<Pick<Asset, 'focalPoint'>>) | string,
	widths: number[],
	transform: Omit<ImageTransform, 'w'> = {},
) =>
	widths.map((w) => `${imageUrl(asset, { ...transform, w })} ${w}w`).join(', ')
