/**
 * @constant CHAR_SET
 * @description Key/value set of characters to be used for generation strings
 */
const CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * @function getRandomString
 * @description Generate a random string
 */
export function getRandomString(characters: number = 5): string {
	if (!characters || typeof characters !== 'number') return ''
	return Array(characters)
		.fill('')
		.reduce((acc) => {
			acc += CHAR_SET.charAt(Math.floor(Math.random() * CHAR_SET.length))
			return acc
		}, '')
}
