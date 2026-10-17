/**
 * @function diff
 * Get the difference between two numbers
 *
 * @example
 * // returns 2
 * diff(5, 3)
 *
 * @example
 * // returns 1595.26
 * diff(1441.89, 3037.15)
 */
export const diff = (num1: number, num2: number): number =>
	num1 > num2 ? num1 - num2 : num2 - num1
