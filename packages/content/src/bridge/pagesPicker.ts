import type { ContentBridge, SitePage } from './createBridge'
import { element, icon } from './dom'
import type { SharedLabels } from './labels'

// The space's pages as a combobox: a search above a list, to go to one
// (`bridge.pages()`, `bridge.openPage()`). The prompt box and the on-site
// editor each place its parts.

export type PagesPicker = {
	searchRow: HTMLLabelElement
	search: HTMLInputElement
	list: HTMLUListElement
	note: HTMLParagraphElement
	readonly pages: SitePage[] | null
	readonly error: string | null
	current(): SitePage | null
	// Fetched once; again after a failure, or after `forget`.
	fetch(): Promise<void>
	forget(): void
	// Ready to pick: no search, the current page active.
	reset(): void
	render(): void
}

export const createPagesPicker = (
	doc: Document,
	bridge: ContentBridge,
	labels: SharedLabels,
	{
		onLoad,
		onClose,
	}: {
		onLoad: () => void
		// Escape, or the current page picked.
		onClose: () => void
	},
): PagesPicker => {
	const search = element(doc, 'input', {
		type: 'text',
		placeholder: labels.pagesSearch,
		autocomplete: 'off',
		spellcheck: false,
	})
	search.setAttribute('role', 'combobox')
	search.setAttribute('aria-label', labels.pagesSearch)
	search.setAttribute('aria-autocomplete', 'list')
	search.setAttribute('aria-expanded', 'true')
	search.setAttribute('aria-controls', 'obelism-pages')
	const searchRow = element(
		doc,
		'label',
		{ className: 'search' },
		icon(doc, 'search'),
		search,
	)
	const list = element(doc, 'ul', { className: 'options', id: 'obelism-pages' })
	list.setAttribute('role', 'listbox')
	list.setAttribute('aria-label', labels.pages)
	const note = element(doc, 'p', { className: 'empty' })

	let pages: SitePage[] | null = null
	let load: Promise<void> | null = null
	let error: string | null = null
	let active = 0

	const matching = () => {
		const query = search.value.trim().toLowerCase()
		return (pages ?? []).filter(
			(page) =>
				!query ||
				page.name.toLowerCase().includes(query) ||
				page.url.toLowerCase().includes(query) ||
				`/${page.path}`.toLowerCase().includes(query),
		)
	}

	const choose = (page: SitePage) => {
		if (page.entryId === bridge.entryId) return onClose()
		// Asks first when changes aren't saved; stays here if told no.
		bridge.openPage(page)
	}

	const render = () => {
		const options = matching()
		active = Math.max(0, Math.min(active, options.length - 1))
		list.textContent = ''
		options.forEach((page, index) => {
			const option = element(
				doc,
				'li',
				{
					className: `option${index === active ? ' active' : ''}`,
					id: `obelism-page-${index}`,
				},
				element(
					doc,
					'span',
					{ className: 'option-text' },
					element(doc, 'span', { textContent: page.name }),
					element(doc, 'span', {
						className: 'option-path',
						textContent: page.url,
					}),
				),
			)
			option.setAttribute('role', 'option')
			option.setAttribute('aria-selected', String(index === active))
			if (page.status !== 'published') {
				option.appendChild(
					element(doc, 'span', {
						className: 'badge',
						textContent:
							page.status === 'draft' ? labels.pageDraft : labels.pageChanged,
					}),
				)
			}
			if (page.entryId === bridge.entryId) {
				option.setAttribute('aria-current', 'page')
				const check = icon(doc, 'check')
				check.removeAttribute('aria-hidden')
				check.setAttribute('role', 'img')
				check.setAttribute('aria-label', labels.pageCurrent)
				option.appendChild(check)
			}
			option.addEventListener('click', () => choose(page))
			list.appendChild(option)
		})
		const activeOption = list.children[active]
		if (activeOption) {
			search.setAttribute('aria-activedescendant', activeOption.id)
			activeOption.scrollIntoView?.({ block: 'nearest' })
		} else {
			search.removeAttribute('aria-activedescendant')
		}
		const text = error ?? (pages ? '' : labels.pagesLoading)
		note.textContent = text || (options.length === 0 ? labels.pagesEmpty : '')
		note.hidden = !note.textContent
		note.className = `empty${error ? ' error' : ''}`
	}

	const fetch = () => {
		load ??= bridge.pages().then(
			(list) => {
				pages = list
				error = null
				render()
				onLoad()
			},
			(reason: unknown) => {
				load = null
				error = reason instanceof Error ? reason.message : String(reason)
				render()
				onLoad()
			},
		)
		return load
	}

	search.addEventListener('input', () => {
		active = 0
		render()
	})
	search.addEventListener('keydown', (event) => {
		const count = list.children.length
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			if (count === 0) return
			active = (active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
			render()
		} else if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault()
			const page = matching()[active]
			if (page) choose(page)
		} else if (event.key === 'Escape') {
			event.preventDefault()
			onClose()
		}
	})

	return {
		searchRow,
		search,
		list,
		note,
		get pages() {
			return pages
		},
		get error() {
			return error
		},
		current: () =>
			pages?.find(({ entryId }) => entryId === bridge.entryId) ?? null,
		fetch,
		forget() {
			pages = null
			load = null
		},
		reset() {
			search.value = ''
			active = Math.max(
				0,
				(pages ?? []).findIndex(({ entryId }) => entryId === bridge.entryId),
			)
			void fetch()
			render()
		},
		render,
	}
}
