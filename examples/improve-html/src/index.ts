import { ImproveClientSDK } from '@obelism/improve-sdk/client'

const improveClient = new ImproveClientSDK({
	organizationId: 'org_MJFL46Z0WXGQ5OHW1ZXSM3Q88S',
	environment: 'staging',
})

improveClient.fetchConfig().then(() => {
	improveClient.setupVisitor(window.navigator.userAgent)

	const value = improveClient.getTestValue('startpage-visual')

	document.querySelector('#output').textContent = value
})
