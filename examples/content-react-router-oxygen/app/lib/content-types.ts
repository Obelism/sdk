import type {
	Hero,
	MediaShowcase,
	Page,
	RichText,
} from '../../content/content-types'

export type HeroBlock = Hero
export type RichTextBlock = RichText
export type MediaShowcaseBlock = MediaShowcase
export type PageBlock = Hero | MediaShowcase | RichText

// The generated page body also allows an `_improve` block; this example decides
// its variant in the loader, so it renders the plain blocks.
export type PageEntry = Omit<Page, 'fields'> & {
	fields: Omit<Page['fields'], 'body'> & { body: PageBlock[] | null }
}
