# @obelism/content-plugin

Build plugins for [Obelism Content](https://content.obelism.studio/docs/guides/plugins): your own web page as a field's input or a dashboard page, loaded by Content in a sandboxed frame.

```ts
import { connect } from '@obelism/content-plugin'

const plugin = await connect()
input.value = String(plugin.context.value ?? '')
input.oninput = () => plugin.setValue(input.value)
plugin.onValue((value) => (input.value = String(value ?? '')))
```

In React, `usePlugin()` from `@obelism/content-plugin/react` gives `{ plugin, context, error }`, kept current.

On your backend, with the `token` permission:

```ts
import { verifyContextToken } from '@obelism/content-plugin/server'

const claims = await verifyContextToken(token, { pluginId: 'brand-colour' })
```

## Your page's headers

Content frames your page, so allow it, and, for editing on your own site, your site too (browsers check every frame up to the top):

```http
Content-Security-Policy: frame-ancestors https://content.obelism.studio https://www.example.com
```

## The manifest

Register a plugin in Content (**Plugins**) by the URL of its manifest. `MANIFEST_SCHEMA` is its JSON Schema.

```json
{
	"id": "brand-colour",
	"name": "Brand colour",
	"url": "https://plugins.example.com/brand-colour/",
	"locations": [{ "type": "field", "fieldTypes": ["text"] }],
	"permissions": ["token"]
}
```

## Starter: a field editor

```html
<!doctype html>
<input id="value" />
<script type="module">
	import { connect } from 'https://esm.sh/@obelism/content-plugin'

	const input = document.getElementById('value')
	const plugin = await connect()
	input.value = String(plugin.context.value ?? '')
	input.disabled = plugin.context.readOnly
	input.oninput = () => plugin.setValue(input.value)
	plugin.onValue((value) => (input.value = String(value ?? '')))
</script>
```

## Starter: a page

```ts
import { connect } from '@obelism/content-plugin'

const plugin = await connect()
const { token } = await plugin.token()
const report = await fetch('/api/report', {
	headers: { Authorization: `Bearer ${token}` },
}).then((response) => response.json())
```
