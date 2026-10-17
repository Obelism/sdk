import { afterEach, expect, test } from 'vitest'

import {
	ImproveDataLayerEntry,
	pushDataLayer,
	resetDataLayerEcommerce,
} from './pushDataLayer'

const setWindow = (value: unknown) => {
	;(globalThis as { window?: unknown }).window = value
}

afterEach(() => {
	delete (globalThis as { window?: unknown }).window
})

const entry: ImproveDataLayerEntry = {
	event: 'page_view',
	improve: { visitorId: 'visi_X' },
	_improve: true,
}

test('initializes the dataLayer and pushes the entry', () => {
	setWindow({})

	pushDataLayer(entry)

	expect((globalThis as { window: Window }).window.dataLayer).toEqual([entry])
})

test('appends when GTM already created the dataLayer', () => {
	setWindow({ dataLayer: [{ event: 'gtm.js' }] })

	pushDataLayer(entry)

	const { dataLayer } = (globalThis as { window: Window }).window
	expect(dataLayer).toHaveLength(2)
	expect(dataLayer?.[1]).toEqual(entry)
})

test('carries value, currency and extra params on the entry', () => {
	setWindow({})

	const ecommerceEntry: ImproveDataLayerEntry = {
		...entry,
		event: 'purchase',
		value: 72.05,
		currency: 'USD',
		ecommerce: { transaction_id: 'T_1', items: [{ item_id: 'SKU_1' }] },
	}

	pushDataLayer(ecommerceEntry)

	expect((globalThis as { window: Window }).window.dataLayer?.[0]).toEqual(
		ecommerceEntry,
	)
})

test('is a no-op without a window (server-side)', () => {
	expect(() => pushDataLayer(entry)).not.toThrow()
})

test('resetDataLayerEcommerce pushes an ecommerce:null reset', () => {
	setWindow({ dataLayer: [{ event: 'gtm.js' }] })

	resetDataLayerEcommerce()

	const { dataLayer } = (globalThis as { window: Window }).window
	expect(dataLayer).toHaveLength(2)
	expect(dataLayer?.[1]).toEqual({ ecommerce: null })
})

test('resetDataLayerEcommerce is a no-op without a window (server-side)', () => {
	expect(() => resetDataLayerEcommerce()).not.toThrow()
})
