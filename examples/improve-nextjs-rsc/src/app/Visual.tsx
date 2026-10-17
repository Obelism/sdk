'use client'

import Image from 'next/image'

import { usePostAnalytic } from './improve'
import { Variant } from './improveConfig'

export const Visual = ({
	className,
	variant,
}: {
	className?: string
	variant: Variant
}) => {
	const postAnalytic = usePostAnalytic()

	return (
		<Image
			className={className}
			src="/next.svg"
			alt="Next.js Logo"
			width={180}
			height={37}
			priority
			style={variant === 'control' ? {} : { transform: 'scaleX(-1)' }}
			onClick={() => {
				postAnalytic('visual_click')
			}}
		/>
	)
}
