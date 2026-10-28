import { editable, imageSrcSet, imageUrl } from '@obelism/content'
import { RichText, useLiveEntry } from '@obelism/content-react'
import { Link } from 'react-router'

import type { ReactNode } from 'react'

import type {
	HeroBlock,
	MediaShowcaseBlock,
	PageBlock,
	PageEntry,
	RichTextBlock,
} from '~/lib/content-types'

type Variant = { value: string } | null

const HERO_COPY: Record<string, { eyebrow: string; heading: string }> = {
	b: {
		eyebrow: 'Variant B · this page is the test',
		heading: 'Variant B: the loader decided this before the first paint.',
	},
}

const assetAlt = (asset: { alt: string | Record<string, string> | null }) =>
	typeof asset.alt === 'string' ? asset.alt : (asset.alt?.en ?? '')

function Hero({ block, variant }: { block: HeroBlock; variant?: Variant }) {
	const copy = variant?.value ? HERO_COPY[variant.value] : undefined
	const heading = copy?.heading ?? block.heading
	const eyebrow = copy?.eyebrow ?? block.eyebrow

	return (
		<section
			{...editable(block)}
			data-improve-test={variant ? 'home-hero' : undefined}
			data-improve-variant={variant?.value}
			className="bg-surface-secondary w-full"
		>
			<div className="max-w-page px-margin mx-auto grid items-center gap-8 py-16 md:grid-cols-2 md:py-24">
				<div>
					{eyebrow ? (
						<p className="type-body-sm text-on-surface-secondary mb-4 tracking-widest uppercase">
							{eyebrow}
						</p>
					) : null}
					<h1 className="type-display text-on-surface">{heading}</h1>
					{block.text ? (
						<p className="type-body-lg text-on-surface-secondary mt-6 max-w-prose">
							{block.text}
						</p>
					) : null}
					{block.ctaLabel && block.ctaHref ? (
						<Link
							to={block.ctaHref}
							className="rounded-button button-primary focus-visible:outline-accent mt-8 inline-flex min-h-11 items-center px-5 text-sm font-medium no-underline"
						>
							{block.ctaLabel}
						</Link>
					) : null}
				</div>
				{block.image ? (
					<img
						src={imageUrl(block.image, { w: 960 })}
						srcSet={imageSrcSet(block.image, [480, 960, 1440], {
							fit: 'cover',
						})}
						sizes="(min-width: 48rem) 50vw, 100vw"
						width={block.image.width ?? undefined}
						height={block.image.height ?? undefined}
						alt={assetAlt(block.image)}
						className="bg-surface aspect-square w-full rounded-sm object-cover"
					/>
				) : null}
			</div>
		</section>
	)
}

function TextBlock({ block }: { block: RichTextBlock }) {
	return (
		<section
			{...editable(block)}
			className="max-w-page px-margin mx-auto w-full py-12"
		>
			{block.heading ? (
				<h2 className="type-heading-xl mb-6">{block.heading}</h2>
			) : null}
			<div className="richtext text-on-surface-secondary max-w-prose">
				<RichText document={block.text} />
			</div>
		</section>
	)
}

function Hotspots({ block }: { block: MediaShowcaseBlock }) {
	const image = block.image
	if (!image) return null
	const products = image.products ?? []

	return (
		<figure className="relative">
			<img
				src={imageUrl(image, { w: 960 })}
				srcSet={imageSrcSet(image, [480, 960, 1440], { fit: 'cover' })}
				sizes="(min-width: 64rem) 60vw, 100vw"
				width={image.width ?? undefined}
				height={image.height ?? undefined}
				alt={assetAlt(image)}
				className="bg-surface-secondary w-full rounded-sm object-cover"
			/>
			{products.map((product, index) =>
				product.position ? (
					<Link
						key={product.id}
						to={`/p/${product.id.split('/').pop()}`}
						aria-label={`Product hotspot: ${product.handle}`}
						title={product.handle}
						className="bg-interactive text-interactive-text absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-xs font-medium no-underline shadow"
						style={{
							left: `${product.position.x * 100}%`,
							top: `${product.position.y * 100}%`,
						}}
						data-hotspot={product.handle}
					>
						{index + 1}
					</Link>
				) : null,
			)}
			<figcaption
				className="text-on-surface-secondary mt-2 text-xs"
				data-hotspot-count={products.length}
			>
				{products.length > 0
					? "Hotspots come from the asset's products[].position in Content."
					: 'This asset has no products tagged in media, so there are no hotspots.'}
			</figcaption>
		</figure>
	)
}

function MediaShowcase({ block }: { block: MediaShowcaseBlock }) {
	const gallery = block.gallery ?? []

	return (
		<section
			{...editable(block)}
			className="max-w-page px-margin mx-auto w-full py-12"
			data-media-showcase
		>
			<h2 className="type-heading-xl mb-3">{block.heading}</h2>
			{block.body ? (
				<p className="text-on-surface-secondary mb-8 max-w-prose">
					{block.body}
				</p>
			) : null}
			<div className="grid gap-8 md:grid-cols-[3fr_2fr]">
				<Hotspots block={block} />
				<div className="space-y-6">
					{block.privateFile ? (
						<div className="border-border rounded-sm border p-4">
							<h3 className="text-lg font-medium">Private file</h3>
							<p className="text-on-surface-secondary mt-1 text-sm">
								Signed on the server, valid until the end of the hour plus a
								day.
							</p>
							<a
								className="text-interactive mt-2 inline-block text-sm underline"
								href={block.privateFile.url}
								data-private-file
							>
								{block.privateFile.filename}
							</a>
						</div>
					) : null}
					{gallery.length > 0 ? (
						<ul role="list" className="grid grid-cols-2 gap-2">
							{gallery.map((asset) => (
								<li key={asset.id}>
									<img
										src={imageUrl(asset, { w: 640 })}
										srcSet={imageSrcSet(asset, [320, 640])}
										sizes="(min-width: 48rem) 20vw, 40vw"
										width={asset.width ?? undefined}
										height={asset.height ?? undefined}
										alt={assetAlt(asset)}
										loading="lazy"
										className="bg-surface-secondary aspect-square w-full rounded-sm object-cover"
									/>
								</li>
							))}
						</ul>
					) : null}
				</div>
			</div>
		</section>
	)
}

function Block({ block, variant }: { block: PageBlock; variant?: Variant }) {
	switch (block._type) {
		case 'hero':
			return <Hero block={block} variant={variant} />
		case 'richText':
			return <TextBlock block={block} />
		case 'mediaShowcase':
			return <MediaShowcase block={block} />
		default:
			return null
	}
}

export function ContentPage({
	entry,
	variant,
	showTitle = true,
	children,
}: {
	entry: PageEntry
	variant?: Variant
	showTitle?: boolean
	children?: ReactNode
}) {
	const live = useLiveEntry(entry)

	return (
		<div {...editable(live)}>
			{showTitle && live.fields.title ? (
				<div className="max-w-page px-margin mx-auto w-full pt-12">
					<h1 className="type-display">{live.fields.title}</h1>
				</div>
			) : null}
			{live.fields.body?.map((block) => (
				<Block key={block._uid} block={block} variant={variant} />
			))}
			{children}
		</div>
	)
}

// The small print a draft response needs: never cached, never indexed.
export const draftHeaders = (headers: Headers) => {
	headers.set('Cache-Control', 'private, no-store')
	headers.set('X-Robots-Tag', 'noindex')
}
