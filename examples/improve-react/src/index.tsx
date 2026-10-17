import React from 'react'
import { createRoot } from 'react-dom/client'
import { generateImproveProvider } from '@obelism/improve-sdk-react'

const { ImproveProvider, useTestValue, useImproveStatus } =
	generateImproveProvider({
		organizationId: 'org_MJFL46Z0WXGQ5OHW1ZXSM3Q88S',
		environment: 'staging',
	})

const Example = () => {
	const status = useImproveStatus()
	const testValue = useTestValue('startpage-visual')

	return (
		<>
			<h1>Static React website</h1>
			<p>
				Your version: <span>{testValue}</span>
			</p>
		</>
	)
}

const rootElement = document.querySelector('#root')
const root = createRoot(rootElement)

root.render(
	<ImproveProvider>
		<Example />
	</ImproveProvider>,
)
