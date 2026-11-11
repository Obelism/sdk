# Obelism Improve Vue SDK

The Vue SDK sits around the [Javascript Client SDK](https://improve.obelism.studio/docs/sdk/javascript#client) and gives Vue 3 and Nuxt a provider and composables.

## Install

```bash
npm i @obelism/improve-sdk @obelism/improve-sdk-vue
```

## Setup

```ts
// improve.ts
import { generateImproveProvider } from '@obelism/improve-sdk-vue'

export const {
	ImproveProvider,
	useImproveStatus,
	usePostAnalytic,
	useTestValue,
	useFlagValue,
} = generateImproveProvider({
	organizationId: 'org_…',
	environment: 'production',
})
```

```vue
<!-- app.vue -->
<template>
	<ImproveProvider>
		<NuxtPage />
	</ImproveProvider>
</template>
```

## API

### generateImproveProvider

```ts
generateImproveProvider(improveArgs: {
	organizationId: string
	spaceId?: string // the space; without it, the organization's first
	environment: 'develop' | 'staging' | 'production'
	config?: Configuration
	fetchTimeout?: number
}) => ({
	ImproveProvider,
	useImproveStatus,
	usePostAnalytic,
	useTestValue,
	useFlagValue,
})
```

Generates the provider component and the composables that read it. Each call
has its own, so two spaces on one page never mix.

### ImproveProvider

After mount it loads the client SDK, and the config unless one was given. The
server and hydration render the fallbacks.

### useTestValue / useFlagValue

```ts
const variant = useTestValue('hero', 'control') // ComputedRef<string | undefined>
const banner = useFlagValue('banner')
```

Wrappers around [getTestValue](https://improve.obelism.studio/docs/sdk/javascript#gettestvalue) and [getFlagValue](https://improve.obelism.studio/docs/sdk/javascript#getflagvalue): the fallback until the SDK is set up, then the visitor's value. Reading a test's value records its exposure.

### usePostAnalytic

```vue
<script setup lang="ts">
const postAnalytic = usePostAnalytic()
</script>

<template>
	<button @click="postAnalytic('click', 'hero_cta')">…</button>
</template>
```

Wrapper around [postAnalytic](https://improve.obelism.studio/docs/sdk/javascript#postanalytic). Does nothing until the SDK is set up.

### useImproveStatus

`ComputedRef<'loading' | 'setup' | 'error'>`.

Call the composables in `setup`, below the provider.
