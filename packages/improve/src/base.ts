import {
	CONFIG_RETRY_BASE_DELAY_MS,
	CONFIG_RETRY_COUNT,
	CONFIG_RETRY_MAX_DELAY_MS,
	COOKIE_NAME_VISITOR,
	VISITOR_ID_LENGTH,
	VISITOR_ID_PREFIX,
	VISITOR_ID_SEPARATOR,
} from './config/constants'
import { CONFIG_PATH, BASE_URL } from './config/urls'
import {
	ImproveConfiguration,
	ImproveEnvironmentOption,
	ImproveSetupArgs,
	ImproveTestState,
} from './types'
import { delay } from './utils/delay'
import { getReasonFromStatus, ImproveFetchError } from './utils/errors'
import { getRandomString } from './utils/getRandomString'
import { normalizeConfig } from './utils/normalizeConfig'
import { getBackoffDelayMs, parseRetryAfterMs } from './utils/retry'
import { timeoutFetch } from './utils/timeoutFetch'

type ConfigFetch = {
	url: string
	timeout: number
	retries: number
	revalidate?: number
}

// Next.js augments RequestInit with a `next` field for its fetch cache.
type RequestInitWithNext = RequestInit & {
	next?: { revalidate?: number; tags?: string[] }
}

export class BaseImproveSDK {
	organizationId: string
	environment: ImproveEnvironmentOption = 'develop'
	state: ImproveTestState

	#configFetch: ConfigFetch | null = null

	#warningsDisabled: boolean = false

	config: ImproveConfiguration | null = null

	_baseUrl: undefined | string

	constructor({
		organizationId,
		environment,
		state,
		config,
		fetchTimeout,
		baseUrl,
		configRetries,
		configRevalidate,
		disableWarnings,
	}: ImproveSetupArgs) {
		this.organizationId = organizationId
		this.environment = environment
		this.state = state
		this._baseUrl = baseUrl || BASE_URL
		this.#warningsDisabled = disableWarnings ?? false

		if (config) {
			this.config = config
		} else {
			this.#configFetch = {
				url: [
					`${this._baseUrl}${CONFIG_PATH}`,
					this.organizationId,
					this.environment,
					this.state || 'active',
				].join('/'),
				timeout: fetchTimeout || 3000,
				retries: configRetries ?? CONFIG_RETRY_COUNT,
				revalidate: configRevalidate,
			}
		}
	}

	_fetchConfig = async (config?: RequestInit) => {
		if (this.config) return

		if (!this.#configFetch) throw new Error('No config fetch setup provided')

		const { url, timeout, retries, revalidate } = this.#configFetch

		// Opt into the Next.js fetch cache when a revalidate window is configured,
		// so the datafile is reused across requests instead of re-fetched.
		const requestInit: RequestInitWithNext = { ...config }
		if (typeof revalidate === 'number') {
			requestInit.next = {
				...(config as RequestInitWithNext | undefined)?.next,
				revalidate,
			}
		}

		// Seed with a generic network error so an exhausted loop always has a
		// meaningful, typed error to throw.
		let lastError = new ImproveFetchError('network')

		for (let attempt = 0; attempt <= retries; attempt++) {
			if (attempt > 0) {
				// Prefer a server-provided Retry-After; otherwise back off with jitter.
				await delay(
					lastError.retryAfterMs ??
						getBackoffDelayMs(
							attempt - 1,
							CONFIG_RETRY_BASE_DELAY_MS,
							CONFIG_RETRY_MAX_DELAY_MS,
						),
				)
			}

			let res: Response | null
			try {
				res = await timeoutFetch(timeout, url, requestInit)
			} catch (cause) {
				// timeoutFetch aborts on timeout (AbortError) and rejects on
				// network-level failures — both are transient and retryable.
				const aborted = cause instanceof Error && cause.name === 'AbortError'
				lastError = new ImproveFetchError(aborted ? 'timeout' : 'network', {
					cause,
				})
				continue
			}

			// timeoutFetch resolves null when the timeout wins the race.
			if (!res) {
				lastError = new ImproveFetchError('timeout')
				continue
			}

			if (res.ok) {
				try {
					this.config = normalizeConfig(await res.json())
				} catch (cause) {
					lastError =
						cause instanceof ImproveFetchError
							? cause
							: new ImproveFetchError('invalid-response', { cause })
					continue
				}
				return this.config
			}

			lastError = new ImproveFetchError(getReasonFromStatus(res.status), {
				status: res.status,
				retryAfterMs: parseRetryAfterMs(res.headers.get('Retry-After')),
			})

			// Auth/validation rejections won't change on retry — fail fast.
			if (!lastError.isRetryable) break
		}

		throw lastError
	}

	loadConfig = (config: ImproveConfiguration) => {
		this.config = config
	}

	generateVisitorId = () => {
		return [
			VISITOR_ID_PREFIX,
			getRandomString(VISITOR_ID_LENGTH).toUpperCase(),
		].join(VISITOR_ID_SEPARATOR)
	}

	getVisitorCookieName = () => COOKIE_NAME_VISITOR

	/**
	 * Emit a development warning, unless warnings were disabled via the
	 * `disableWarnings` setup option. Centralized so every SDK warning honors the
	 * same switch. No-op where `console` is unavailable.
	 */
	protected _warn = (message: string) => {
		if (this.#warningsDisabled) return
		if (typeof console === 'undefined') return
		console.warn(`[Improve] ${message}`)
	}

	validateTestValue = (testName: string, testValue: string) => {
		if (!this.config)
			throw new Error(
				'Config is required before validating, either use `.fetchConfig()`, .loadConfig(config) or provide it during setup',
			)

		const testConfig = this.config.tests[testName]

		if (!testConfig) throw new Error(`No config found for ${testName}`)

		return Boolean(
			testConfig.options.find((option) => option.slug === testValue),
		)
	}

	validateVisitorId = (possibleVisitorId: string) => {
		const visitorIdParts = possibleVisitorId.split(VISITOR_ID_SEPARATOR)
		if (visitorIdParts.length !== 2) return false
		const [key, value] = visitorIdParts as [string, string]
		return key === VISITOR_ID_PREFIX && value.length === VISITOR_ID_LENGTH
	}
}
