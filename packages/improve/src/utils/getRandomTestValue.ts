import { ImproveTestOption } from '../types'

// function cryptoRandom() {
// 	return crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)
// }

export const getRandomTestValue = (options: ImproveTestOption[]) => {
	if (options.length === 0) return null
	if (options.length === 1) return options[0].slug

	// Get a random number between 0 and 1
	const sum = options.reduce((acc, { split }) => acc + split, 0)
	let value = Math.random() * sum

	const match =
		options.find(({ split }) => {
			value -= split
			return value <= 0
		}) || options[0]

	return match.slug
}
