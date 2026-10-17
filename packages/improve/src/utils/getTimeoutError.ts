import { delay } from './delay'

/**
 * @async @function getTimeoutError
 * @description Throw an error after a delay
 *
 * @param {number} [timeout] - time in ms after to reject default: 1000
 * @param {AbortController} [controller] - (optional) AbortController to abort the request
 */
export const getTimeoutError = async (
	timeout: number = 1000,
	controller: AbortController,
): Promise<null> => {
	await delay(timeout)
	controller?.abort()
	return null
}
