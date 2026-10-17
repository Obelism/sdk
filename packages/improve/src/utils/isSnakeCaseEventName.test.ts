import { expect, test } from 'vitest'

import { isSnakeCaseEventName } from './isSnakeCaseEventName'

test.each(['page_view', 'add_to_cart', 'purchase', 'sign_up', 'view_item_2'])(
	'accepts snake_case %s',
	(event) => {
		expect(isSnakeCaseEventName(event)).toBe(true)
	},
)

test.each([
	'pageView', // camelCase
	'AddToCart', // PascalCase
	'add-to-cart', // kebab-case
	'add to cart', // spaces
	'add__to_cart', // double underscore
	'_add_to_cart', // leading underscore
	'add_to_cart_', // trailing underscore
	'2_step', // leading digit
])('flags non-snake_case %s', (event) => {
	expect(isSnakeCaseEventName(event)).toBe(false)
})
