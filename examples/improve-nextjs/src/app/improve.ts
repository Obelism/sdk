'use client'

import { generateImproveProvider } from '@obelism/improve-sdk-react'
import { IMPROVE_CONFIG } from './improveConfig'

const improveReact = generateImproveProvider(IMPROVE_CONFIG)

export const ImproveProvider = improveReact.ImproveProvider
export const useTestValue = improveReact.useTestValue
export const useFlagValue = improveReact.useFlagValue
export const usePostAnalytic = improveReact.usePostAnalytic
