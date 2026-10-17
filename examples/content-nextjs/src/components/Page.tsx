'use client'

import {
	type Asset,
	type Block,
	editable,
	type Entry,
	RichText,
	type RichTextNode,
	useLiveEntry,
} from '@obelism/content-react'

// The content model this example expects: a `page` type with a `title` and a
// `body` of `hero` and `text` blocks. Adjust to your own model.
type HeroBlock = Block<{ heading: string | null; image: Asset | null }, 'hero'>
type TextBlock = Block<{ text: RichTextNode | null }, 'text'>

export type PageEntry = Entry<
	{ title: string | null; body: (HeroBlock | TextBlock)[] | null },
	'page'
>

// A client component, so unsaved changes show as they are typed in the visual
// editor, or as prompts change them on the site. Otherwise `useLiveEntry`
// just returns `entry`. `editable(entry)` tells editing on the site which
// entry this page is.
export const Page = ({ entry }: { entry: PageEntry }) => {
	const { fields } = useLiveEntry(entry)

	return (
		<main {...editable(entry)}>
			<h1>{fields.title}</h1>
			{fields.body?.map((block) => {
				switch (block._type) {
					case 'hero':
						return (
							<section key={block._uid} {...editable(block)}>
								<h2>{block.heading}</h2>
								{block.image && (
									<img
										src={`${block.image.url}?w=1200`}
										alt={
											typeof block.image.alt === 'string' ? block.image.alt : ''
										}
										width={block.image.width ?? undefined}
										height={block.image.height ?? undefined}
									/>
								)}
							</section>
						)
					case 'text':
						return (
							<section key={block._uid} {...editable(block)}>
								<RichText document={block.text} />
							</section>
						)
					default:
						return null
				}
			})}
		</main>
	)
}
