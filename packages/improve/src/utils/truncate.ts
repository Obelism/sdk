/**
 * @function truncate
 * @description Cap a string to `maxLength` characters. Returns non-strings
 * unchanged so it is safe to apply to loosely-typed payload values.
 *
 * @param {string} value - the value to truncate
 * @param {number} maxLength - maximum length to keep
 */
export const truncate = (value: string, maxLength: number): string =>
	typeof value === 'string' && value.length > maxLength
		? value.slice(0, maxLength)
		: value
