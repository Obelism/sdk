import { createSiteEditing } from '@obelism/content/site'
import { draftMode } from 'next/headers'

// Editing on this site, outside the visual editor: editors open /cms/login
// (add ?return_to=/some/page to come back there), sign in to Obelism
// Content, and come back in draft mode with the prompt bar — Save and
// Publish included. /cms/logout ends it. The site token stays in an httpOnly
// cookie; the bridge reaches the CMS through /cms/api/….
const handler = createSiteEditing({
	spaceId: process.env.CONTENT_SPACE_ID ?? '',
	environment:
		(process.env.CONTENT_ENVIRONMENT as 'develop' | 'staging' | 'production') ??
		'production',
	url: process.env.NEXT_PUBLIC_CONTENT_URL,
	onSignIn: async () => (await draftMode()).enable(),
	onSignOut: async () => (await draftMode()).disable(),
})

export { handler as GET, handler as POST }
