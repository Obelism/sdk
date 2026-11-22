import { IMPROVE_BLOCK } from '../improve'

export type ShownVariant = { kind: string; slug: string; option: string }

const isObject = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value)

export const variantKey = ({ kind, slug }: { kind: string; slug: string }) =>
	`${kind}:${slug}`

// The page's own pickImproveVariant, whatever the visitor's option, can then
// only render the shown one.
export const showVariants = (
	content: unknown,
	shown: ReadonlyMap<string, ShownVariant> | undefined,
): unknown => {
	if (!shown?.size) return content
	const map = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(map)
		if (!isObject(value)) return value
		const mapped = Object.fromEntries(
			Object.entries(value).map(([key, inner]) => [key, map(inner)]),
		)
		if (
			mapped._type !== IMPROVE_BLOCK ||
			typeof mapped.kind !== 'string' ||
			typeof mapped.slug !== 'string' ||
			!isObject(mapped.variants)
		) {
			return mapped
		}
		const variant = shown.get(
			variantKey({ kind: mapped.kind, slug: mapped.slug }),
		)
		if (!variant) return mapped
		const blocks = Object.hasOwn(mapped.variants, variant.option)
			? mapped.variants[variant.option]
			: []
		return { ...mapped, variants: { [variant.option]: blocks } }
	}
	return map(content)
}
