import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import type { ImproveClientSDK } from '@obelism/improve-sdk/client'
import type { ImproveSetupArgs } from '@obelism/improve-sdk/types'

export type ImproveProviderProps = {
	children?: React.ReactNode
}

export type ImproveContextType = {
	getFlagValue: ImproveClientSDK['getFlagValue']
	getTestValue: ImproveClientSDK['getTestValue']
	postAnalytic: ImproveClientSDK['postAnalytic']
}

const DEFAULT_VALUE: ImproveContextType = {
	getFlagValue: () => null,
	getTestValue: () => null,
	postAnalytic: () => null,
}

type ImproveStatus = 'loading' | 'setup' | 'error'

const ImproveStatusContext = createContext<ImproveStatus>('loading')
const ImproveContext = createContext<ImproveContextType>(DEFAULT_VALUE)

export const generateImproveProvider = (improveSetupArgs: ImproveSetupArgs) => {
	const ImproveProvider = ({ children }: ImproveProviderProps) => {
		const [status, setStatus] = useState<ImproveStatus>('loading')

		const loadingSdk = useRef<boolean>(false)
		const improveSdkRef = useRef<ImproveClientSDK | null>(null)

		useEffect(() => {
			if (improveSdkRef.current || loadingSdk.current) return
			loadingSdk.current = true
			let loaded = false
			let aborted = false

			import('@obelism/improve-sdk/client')
				.then(async ({ ImproveClientSDK }) => {
					if (aborted) return
					improveSdkRef.current = new ImproveClientSDK(improveSetupArgs)

					if (!improveSetupArgs.config) {
						await improveSdkRef.current.fetchConfig()
					}

					if (aborted) return
					loaded = true
					setStatus('setup')
				})
				.catch((e) => {
					loadingSdk.current = false
					console.error(e)
					setStatus('error')
				})

			return () => {
				if (loaded) return
				loadingSdk.current = false
				aborted = true
			}
		}, [])

		const actions = useMemo(() => {
			if (status !== 'setup' || !improveSdkRef.current) return DEFAULT_VALUE
			return {
				getTestValue: improveSdkRef.current.getTestValue,
				postAnalytic: improveSdkRef.current.postAnalytic,
				getFlagValue: improveSdkRef.current.getFlagValue,
			}
		}, [status])

		return (
			<ImproveStatusContext.Provider value={status}>
				<ImproveContext.Provider value={actions}>
					{children}
				</ImproveContext.Provider>
			</ImproveStatusContext.Provider>
		)
	}

	const useImproveStatus = () => useContext(ImproveStatusContext)

	const usePostAnalytic = () => {
		const { postAnalytic } = useContext(ImproveContext)
		return postAnalytic
	}

	const useTestValue = (testSlug: string, fallback?: string) => {
		const { getTestValue } = useContext(ImproveContext)
		return getTestValue(testSlug) || fallback
	}

	const useFlagValue = (flagSlug: string, fallback?: string) => {
		const { getFlagValue } = useContext(ImproveContext)
		return getFlagValue(flagSlug) || fallback
	}

	return {
		ImproveProvider,
		useImproveStatus,
		usePostAnalytic,
		useTestValue,
		useFlagValue,
	}
}
