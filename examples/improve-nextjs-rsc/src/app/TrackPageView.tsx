'use client'

import { useEffect } from 'react'

import { usePostAnalytic } from './improve'

export const TrackPageView = ({ page }: { page: string }) => {
	const postAnalytic = usePostAnalytic()

	useEffect(() => {
		postAnalytic('page_view', page)
	}, [page, postAnalytic])

	return null
}
