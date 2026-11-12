import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateImproveProvider } from './index'

const fetchConfig = vi.fn(async () => {})
const postAnalytic = vi.fn(() => true)
const constructed = vi.fn()
vi.mock('@obelism/improve-sdk/client', () => ({
	ImproveClientSDK: class {
		constructor(args: unknown) {
			constructed(args)
		}
		fetchConfig = fetchConfig
		postAnalytic = postAnalytic
		getTestValue = (slug: string) => (slug === 'hero' ? 'variation' : null)
		getFlagValue = (slug: string) => (slug === 'banner' ? 'on' : null)
	},
}))

const args = { organizationId: 'org_1', environment: 'production' as const }

const mountWith = (improve: ReturnType<typeof generateImproveProvider>) => {
	const Child = defineComponent({
		setup() {
			const status = improve.useImproveStatus()
			const hero = improve.useTestValue('hero', 'control')
			const missing = improve.useTestValue('missing', 'fallback')
			const banner = improve.useFlagValue('banner')
			const post = improve.usePostAnalytic()
			return () =>
				h(
					'button',
					{ onClick: () => post('click', 'hero_cta') },
					`${status.value} ${hero.value} ${missing.value} ${banner.value}`,
				)
		},
	})
	return mount(improve.ImproveProvider, { slots: { default: () => h(Child) } })
}

beforeEach(() => {
	fetchConfig.mockReset()
	postAnalytic.mockClear()
	constructed.mockClear()
})

describe('generateImproveProvider', () => {
	it('shows the fallbacks until the SDK is set up, then its values', async () => {
		const wrapper = mountWith(generateImproveProvider(args))
		expect(wrapper.text()).toBe('loading control fallback undefined')

		await flushPromises()
		expect(constructed).toHaveBeenCalledWith(args)
		expect(fetchConfig).toHaveBeenCalledTimes(1)
		expect(wrapper.text()).toBe('setup variation fallback on')

		await wrapper.get('button').trigger('click')
		expect(postAnalytic).toHaveBeenCalledWith('click', 'hero_cta')
	})

	it('skips the fetch when given a config', async () => {
		const config = { tests: {}, flags: {} } as never
		mountWith(generateImproveProvider({ ...args, config }))
		await flushPromises()
		expect(fetchConfig).not.toHaveBeenCalled()
	})

	it('reports an error when the config fails to load', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		fetchConfig.mockRejectedValueOnce(new Error('offline'))
		const wrapper = mountWith(generateImproveProvider(args))
		await flushPromises()
		expect(wrapper.text()).toBe('error control fallback undefined')
	})

	it('renders the fallbacks on the server without loading the SDK', async () => {
		const improve = generateImproveProvider(args)
		const Child = defineComponent({
			setup() {
				const hero = improve.useTestValue('hero', 'control')
				return () => h('p', hero.value)
			},
		})
		const html = await renderToString(
			h(improve.ImproveProvider, null, { default: () => h(Child) }),
		)
		expect(html).toContain('<p>control</p>')
		expect(constructed).not.toHaveBeenCalled()
	})

	it('keeps each call to itself', async () => {
		const first = generateImproveProvider(args)
		const second = generateImproveProvider({ ...args, organizationId: 'org_2' })
		const Child = defineComponent({
			setup() {
				const hero = second.useTestValue('hero', 'outside')
				return () => h('p', hero.value)
			},
		})
		const wrapper = mount(first.ImproveProvider, {
			slots: { default: () => h(Child) },
		})
		await flushPromises()
		expect(wrapper.text()).toBe('outside')
	})

	it('stops setting up once unmounted', async () => {
		const wrapper = mountWith(generateImproveProvider(args))
		wrapper.unmount()
		await flushPromises()
		expect(fetchConfig).not.toHaveBeenCalled()
	})
})
