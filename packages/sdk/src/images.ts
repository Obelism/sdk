import type { Asset } from './types'

export type ImageTransform = {
	// Pixels, up to 1920.
	w?: number
	h?: number
	fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
	// `auto` (the API's default) picks AVIF or WebP when the browser takes them.
	format?: 'auto' | 'avif' | 'webp' | 'jpeg' | 'png'
	// Quality, 1–100 (the API's default is 80).
	q?: number
}

const KEYS = ['w', 'h', 'fit', 'format', 'q'] as const

// An asset's URL with a resize / re-encode query. PNG, JPEG, GIF, WebP and
// AVIF are transformed; other files ignore the query.
//
//   imageUrl(asset, { w: 800 })
export const imageUrl = (
	asset: Pick<Asset, 'url'> | string,
	transform: ImageTransform = {},
) => {
	const url = new URL(typeof asset === 'string' ? asset : asset.url)
	for (const key of KEYS) {
		const value = transform[key]
		if (value !== undefined) url.searchParams.set(key, String(value))
	}
	return url.toString()
}

// A `srcset` with one candidate per width.
//
//   <img src={imageUrl(asset, { w: 960 })}
//        srcSet={imageSrcSet(asset, [480, 960, 1440])}
//        sizes="(min-width: 60rem) 50vw, 100vw" />
export const imageSrcSet = (
	asset: Pick<Asset, 'url'> | string,
	widths: number[],
	transform: Omit<ImageTransform, 'w'> = {},
) =>
	widths.map((w) => `${imageUrl(asset, { ...transform, w })} ${w}w`).join(', ')
