import {
	computed,
	type ComputedRef,
	defineComponent,
	inject,
	type InjectionKey,
	onMounted,
	onUnmounted,
	provide,
	type Ref,
	ref,
	type ShallowRef,
	shallowRef,
} from 'vue'
import type { ImproveClientSDK } from '@obelism/improve-sdk/client'
import type { ImproveSetupArgs } from '@obelism/improve-sdk/types'

export type ImproveStatus = 'loading' | 'setup' | 'error'

type ImproveContext = {
	status: Ref<ImproveStatus>
	sdk: ShallowRef<ImproveClientSDK | null>
}

export const generateImproveProvider = (improveSetupArgs: ImproveSetupArgs) => {
	// One key per call, so two providers on a page (two spaces) never mix.
	const key: InjectionKey<ImproveContext> = Symbol('improve')

	// Loads the client SDK and its config after mount, so the server and
	// hydration render the fallbacks.
	const ImproveProvider = defineComponent({
		name: 'ImproveProvider',
		setup(_, { slots }) {
			const status = ref<ImproveStatus>('loading')
			const sdk = shallowRef<ImproveClientSDK | null>(null)
			let aborted = false

			onMounted(() => {
				import('@obelism/improve-sdk/client')
					.then(async ({ ImproveClientSDK }) => {
						if (aborted) return
						const client = new ImproveClientSDK(improveSetupArgs)
						if (!improveSetupArgs.config) await client.fetchConfig()
						if (aborted) return
						sdk.value = client
						status.value = 'setup'
					})
					.catch((e) => {
						console.error(e)
						status.value = 'error'
					})
			})
			onUnmounted(() => {
				aborted = true
			})

			provide(key, { status, sdk })
			return () => slots.default?.()
		},
	})

	const useContext = (): ImproveContext | null => inject(key, null)

	const useImproveStatus = (): ComputedRef<ImproveStatus> => {
		const context = useContext()
		return computed(() => context?.status.value ?? 'loading')
	}

	const usePostAnalytic = () => {
		const context = useContext()
		return (...args: Parameters<ImproveClientSDK['postAnalytic']>) =>
			context?.sdk.value?.postAnalytic(...args) ?? null
	}

	const useTestValue = (
		testSlug: string,
		fallback?: string,
	): ComputedRef<string | undefined> => {
		const context = useContext()
		return computed(
			() => context?.sdk.value?.getTestValue(testSlug) || fallback,
		)
	}

	const useFlagValue = (
		flagSlug: string,
		fallback?: string,
	): ComputedRef<string | undefined> => {
		const context = useContext()
		return computed(
			() => context?.sdk.value?.getFlagValue(flagSlug) || fallback,
		)
	}

	return {
		ImproveProvider,
		useImproveStatus,
		usePostAnalytic,
		useTestValue,
		useFlagValue,
	}
}
