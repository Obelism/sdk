# Obelism Improve React SDK

The React SDK sits around the [Javascript Client SDK](https://improve.obelism.studio/docs/sdk/javascript#client) and gives React specific handlers.

## Install

```bash
npm i @obelism/improve-sdk-react
```

## Setup

In your config folder create the following file: `improveClient.ts`

```ts
import { generateImproveProvider } from '@obelism/improve-sdk-react'

export default generateImproveProvider(...)
```

## API

### generateImproveProvider

```ts
generateImproveProvider(improveArgs: {
	organizationId: string
	environment: 'develop' | 'staging' | 'production'
	config?: Configuration
	fetchTimeout?: number
}) => ({
    ImproveProvider,
    usePostAnalytic,
    useTestValue,
    useFlagValue
})
```

Setup function that generates the React component and hooks.

### ImproveProvider

```ts
<ImproveProvider>
    {children}
</ImproveProvider>
```

On mount this automatically fetches the ImproveSDK and the config if not provided initially. Exposes a context that is used to populate data to the hooks down the component tree.

### useFlagValue

```ts
const value: string = useFlagValue(flagSlug: string)
```

Wrapper around [getFlagValue](https://improve.obelism.studio/docs/sdk/javascript#getflagvalue) that's passed down when the context is setup.

### useTestValue

```ts
const value: string = useTestValue(testSlug: string)
```

Wrapper around [getTestValue](https://improve.obelism.studio/docs/sdk/javascript#gettestvalue) that's passed down when the context is setup.

### usePostAnalytic

```ts
const postAnalytic = usePostAnalytic()

<button onClick={() => postAnalytic(event: string, scope: string)} />
```

Wrapper around [postAnalytic](https://improve.obelism.studio/docs/sdk/javascript#postanalytic) that's passed down when the context is setup.

## NextJS App router

For NextJS we need to make sure the generated provider is marked as a client component. For this we need to declare the `ImproveProvider` within the file we declare `"use client"`.

This is needed because the ImproveProvider uses an `useEffect` to fetch load the JS SDK async and fetch the config async if needed. After it's setup it uses context to pass the data down.

```ts
'use client'

import { generateImproveProvider } from 'utils/generateImproveProvider'

const improveReact = generateImproveProvider(...)

export const ImproveProvider = improveReact.ImproveProvider
export const useTestValue = improveReact.useTestValue
export const useFlagValue = improveReact.useFlagValue
export const usePostAnalytic = improveReact.usePostAnalytic
```
