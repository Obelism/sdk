import { getTimeoutError } from './getTimeoutError'

/**
 * @async @function timeoutFetch
 * @description Fetch with a timeout
 *
 * @param {number} timeout - time in ms after to reject default: 3000
 * @param {string} url - url to fetch
 * @param {Object} [options] - (optional) options to pass to fetch
 */
export const timeoutFetch = (
	timeout: number = 3000,
	url: string,
	options?: object,
) => {
	const controller = new AbortController()
	return Promise.race([
		fetch(url, {
			...options,
			signal: controller.signal,
		}),
		getTimeoutError(timeout, controller),
	])
}
