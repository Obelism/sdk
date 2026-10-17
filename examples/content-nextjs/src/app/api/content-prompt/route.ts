import Anthropic from '@anthropic-ai/sdk'
import { createPromptHandler } from '@obelism/content/prompt'

// Your own model for prompt editing, instead of the CMS's default (Workers
// AI). Set this route's URL under Space settings → Prompt editing and put the
// signing secret it shows in CONTENT_PROMPT_SECRET. Optional: without it the
// CMS uses Workers AI and this route is never called.
//
// The CMS writes the instructions and checks the answer; this only runs the
// model. The instructions already ask for JSON only, and the CMS reads JSON
// text (also inside a code fence), so the text is returned as is.

const client = new Anthropic()

export const POST = createPromptHandler({
	secret: process.env.CONTENT_PROMPT_SECRET ?? '',
	generate: async ({ system, messages }) => {
		const response = await client.beta.messages.create({
			model: 'claude-opus-5-5',
			max_tokens: 16000,
			// On a safety decline, the API retries on a fallback model by itself.
			betas: ['server-side-fallback-2026-07-01'],
			fallbacks: 'default',
			system,
			messages,
		})
		if (response.stop_reason === 'refusal') {
			throw new Error('The model declined this request')
		}
		return response.content
			.flatMap((block) => (block.type === 'text' ? [block.text] : []))
			.join('')
	},
})
