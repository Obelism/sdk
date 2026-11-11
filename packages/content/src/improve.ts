import type { Block, ImproveBlock } from './types'

export const IMPROVE_BLOCK = '_improve'

export const isImproveBlock = (block: Block): block is ImproveBlock =>
	block._type === IMPROVE_BLOCK

// The blocks to render for an improve block: the variant of `option`, what
// improve's SDK returned for the visitor (getTestValue / getFlagValue). It
// is null when the test or flag isn't active or the visitor isn't in it;
// then, or for an option the block has no variant for, the `fallback`
// option's variant, else the first one.
export const pickImproveVariant = <TBlock extends Block>(
	block: ImproveBlock<TBlock>,
	option: string | null | undefined,
	fallback?: string | null,
): TBlock[] => {
	const variants = block.variants ?? {}
	if (option && variants[option]) return variants[option]
	// The arm Improve gives a visitor outside the test, when the caller names
	// none: it is not always the first variant.
	const behind = fallback ?? block.fallback
	if (behind && variants[behind]) return variants[behind]
	return Object.values(variants)[0] ?? []
}
