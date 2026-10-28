import { ENTRY_ATTRIBUTE, UID_ATTRIBUTE } from '../editable'
import {
	blockSelector,
	type BridgeState,
	type ContentBridge,
	type FormHandle,
	type SitePage,
} from './createBridge'
import { element, fill, MARKS, svgSpan } from './dom'
import {
	DEFAULT_PROMPT_LABELS,
	type PromptBoxOptions,
	type PromptLabels,
} from './promptBox'

// The on-site editor: editing a site signed in to edit (siteBridge.ts) from
// a panel docked on the right, the site reflowed beside it. Ask (prompts,
// previewed on the page until kept) or Edit fields (the CMS's form, see
// formFrame.ts); the blocks on the page outlined with their names; a launcher
// at the bottom left to hide the panel or the outlines, and to exit. Plain
// DOM in a shadow root, like the prompt box, which the visual editor and
// Content's canvas keep using.

// What the site gives up beside the panel: its 404px and a 16px gap on
// either side.
export const DOCK_WIDTH_PX = 436
// Narrower than this the panel is a sheet over the page instead.
const DOCK_QUERY = '(min-width: 768px)'
const OPEN_KEY = 'obelism-content-editor'
// Changed fields an answer shows; the rest are counted.
const MAX_DIFFS = 3

const ICONS = {
	chevrons: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
	minimise: '<path d="M5 12h14"/>',
	eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
	eyeOff:
		'<path d="M10.7 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
	send: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
	undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
	search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
	check: '<path d="M20 6 9 17l-5-5"/>',
	plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
	scope:
		'<rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="3 3"/>',
	alert:
		'<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
}

// Obelism's tokens (the design system's foundation/tokens.css), copied: a
// shadow root can't reach the site's, nor the site's fonts but Geist's
// family name.
const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font: inherit; color: inherit; margin: 0; }
.root {
	--bg: 255 255 255; --subtle: 250 249 247; --paper: 242 240 236; --actions: 232 229 223;
	--fg: 23 22 20; --soft: 68 64 60; --muted: 105 100 94;
	--hairline: 236 233 228; --border-soft: 220 216 209; --border: 138 132 124;
	--accent: 212 130 30; --focus: 176 98 0; --ink: 23 22 20;
	--positive: 30 112 45; --negative: 184 46 46; --warning: 150 88 0;
	--coral: 251 217 203; --coral-wash: 255 243 236; --coral-ink: 122 46 20;
	--mint-wash: 237 247 240; --mint-ink: 20 83 45;
	--butter-wash: 253 248 228; --butter-ink: 107 78 7;
	--env-develop: 22 163 74; --env-staging: 217 119 6; --env-live: 220 38 38;
	--tile: 23 22 20;
	--shadow-small: 0 1px 2px rgb(23 22 20 / .06);
	--shadow-medium: 0 0 0 1px rgb(23 22 20 / .08), 0 12px 32px rgb(23 22 20 / .14);
	--shadow-large: 0 0 0 1px rgb(23 22 20 / .08), 0 32px 80px rgb(23 22 20 / .28);
	--ease: cubic-bezier(0.2, 0.8, 0.2, 1);
	--font-base: 'Geist', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
		'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	font: 400 14px/20px var(--font-base); color: rgb(var(--fg)); color-scheme: light dark;
	-webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
	.root {
		--bg: 27 26 24; --subtle: 33 31 29; --paper: 17 16 15; --actions: 45 43 40;
		--fg: 242 240 236; --soft: 214 210 204; --muted: 160 154 146;
		--hairline: 44 42 39; --border-soft: 64 61 57; --border: 112 108 102;
		--focus: 212 130 30;
		--positive: 125 190 122; --negative: 240 110 110; --warning: 230 160 60;
		--coral: 92 46 30; --coral-wash: 46 30 24; --coral-ink: 251 196 172;
		--mint-wash: 24 40 30; --mint-ink: 176 226 190;
		--butter-wash: 42 36 20; --butter-ink: 245 222 140;
		--env-develop: 74 222 128; --env-staging: 251 191 36; --env-live: 248 113 113;
		--tile: 45 43 40;
		--shadow-small: 0 1px 2px rgb(0 0 0 / .4);
		--shadow-medium: 0 0 0 1px rgb(255 255 255 / .06), 0 12px 32px rgb(0 0 0 / .5);
		--shadow-large: 0 0 0 1px rgb(255 255 255 / .08), 0 32px 80px rgb(0 0 0 / .6);
	}
}
[hidden] { display: none !important; }
.visually-hidden {
	position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}
.icon { display: inline-flex; flex: none; }
.icon svg {
	width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5;
	stroke-linecap: round; stroke-linejoin: round;
}
.mark { display: inline-flex; flex: none; color: rgb(var(--accent)); }
.mark svg { width: 16px; height: 16px; fill: currentColor; }
.working svg { width: 16px; height: 16px; fill: rgb(var(--muted)); }
.working .accent { fill: rgb(var(--accent)); }
.working svg { animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
button { cursor: pointer; background: none; border: 0; padding: 0; position: relative; }
button:disabled { cursor: not-allowed; }
:focus-visible { outline: 2px solid rgb(var(--focus)); outline-offset: 2px; }
/* 44px targets around smaller-looking controls. */
.hit::after { content: ''; position: absolute; inset: -4px; }

.panel {
	position: fixed; top: 16px; right: 16px; bottom: 16px; width: 404px; z-index: 2147483647;
	display: flex; flex-direction: column; overflow: hidden;
	background: rgb(var(--bg)); border-radius: 22px; box-shadow: var(--shadow-large);
	transition: transform .3s var(--ease), opacity .3s var(--ease), visibility 0s;
}
.panel[data-closed] {
	transform: translateX(calc(100% + 24px)); opacity: 0; visibility: hidden;
	transition: transform .3s var(--ease), opacity .3s var(--ease), visibility 0s .3s;
}
@media (max-width: 767px) {
	.panel { top: auto; left: 8px; right: 8px; bottom: 64px; width: auto; height: min(60vh, 520px); }
	.panel[data-closed] { transform: translateY(24px); }
}
@media (prefers-reduced-motion: reduce) {
	.panel, .panel[data-closed] { transform: none; transition: opacity .2s linear, visibility 0s; }
	.panel[data-closed] { transition: opacity .2s linear, visibility 0s .2s; }
	.working svg { animation: none; }
}
.head {
	display: flex; align-items: center; gap: 8px; padding: 12px 12px 12px 14px;
	border-bottom: 1px solid rgb(var(--hairline));
}
.tile {
	display: inline-flex; align-items: center; justify-content: center; flex: none;
	width: 28px; height: 28px; border-radius: 8px; background: rgb(var(--tile));
}
.tile .mark svg { width: 15px; height: 15px; }
.page-button, .page-name {
	display: inline-flex; align-items: center; gap: 6px; min-width: 0; max-width: 190px; height: 32px;
	padding: 0 10px; border-radius: 999px; background: rgb(var(--paper)); font-size: 13px; font-weight: 500;
}
.page-button:hover { background: rgb(var(--actions)); }
.page-button > span:first-child, .page-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-name { display: block; line-height: 32px; }
.page-button .icon svg { width: 12px; height: 12px; stroke-width: 1.75; }
.env {
	display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; flex: none;
	border-radius: 11px; font-size: 12px; font-weight: 500;
	background: rgb(var(--paper)); color: rgb(var(--soft));
}
.env::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: rgb(var(--muted)); }
.env[data-env='develop'] { background: rgb(var(--mint-wash)); color: rgb(var(--mint-ink)); }
.env[data-env='develop']::before { background: rgb(var(--env-develop)); }
.env[data-env='staging'] { background: rgb(var(--butter-wash)); color: rgb(var(--butter-ink)); }
.env[data-env='staging']::before { background: rgb(var(--env-staging)); }
.env[data-env='production'] { background: rgb(var(--negative) / .1); color: rgb(var(--negative)); }
.env[data-env='production']::before { background: rgb(var(--env-live)); }
.spacer { flex: 1; }
.icon-button {
	display: inline-flex; align-items: center; justify-content: center; flex: none;
	width: 36px; height: 36px; border-radius: 50%; color: rgb(var(--muted));
}
.icon-button:hover { background: rgb(var(--paper)); color: rgb(var(--fg)); }

.pages {
	position: absolute; top: 60px; left: 12px; right: 12px; z-index: 1; max-height: calc(100% - 140px);
	display: flex; flex-direction: column; gap: 8px; padding: 10px;
	background: rgb(var(--bg)); border-radius: 16px; box-shadow: var(--shadow-medium);
}
.search {
	display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; flex: none;
	border: 1px solid rgb(var(--border)); border-radius: 999px; color: rgb(var(--muted));
}
.search:focus-within { border-color: rgb(var(--accent)); }
.search input {
	flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: rgb(var(--fg));
}
.search input::placeholder, textarea::placeholder, .path input::placeholder { color: rgb(var(--muted)); }
.options { list-style: none; padding: 0; overflow-y: auto; display: grid; gap: 2px; min-height: 0; }
.option {
	display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 10px; border-radius: 12px; cursor: pointer;
}
.option:hover, .option.active { background: rgb(var(--paper)); }
.option-text { flex: 1; min-width: 0; display: grid; }
.option-text > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.option-path { font-size: 12px; color: rgb(var(--muted)); }
.option .icon { color: rgb(var(--accent)); }
.badge {
	flex: none; font-size: 12px; padding: 0 8px; border-radius: 999px;
	background: rgb(var(--paper)); color: rgb(var(--soft));
}
.empty { padding: 4px 10px; color: rgb(var(--muted)); }
.empty.error { color: rgb(var(--negative)); }
.new-page { justify-content: flex-start; }

.tabs {
	display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; flex: none;
	margin: 12px 14px 0; padding: 3px; border-radius: 999px; background: rgb(var(--actions));
}
.tab {
	display: flex; align-items: center; justify-content: center; gap: 6px; height: 38px;
	border-radius: 999px; font-size: 13px; font-weight: 500; color: rgb(var(--soft));
}
.tab:hover { color: rgb(var(--fg)); }
.tab[aria-selected='true'] { background: rgb(var(--bg)); color: rgb(var(--fg)); box-shadow: var(--shadow-small); }
.tab .mark svg { width: 12px; height: 12px; }
.ask, .fields { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 14px; display: flex; flex-direction: column; gap: 14px; }
.note {
	display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px;
	background: rgb(var(--coral-wash)); color: rgb(var(--coral-ink)); font-size: 12px; line-height: 18px;
}
.note > span:not(.icon) { flex: 1; min-width: 0; }
.note strong { font-weight: 600; }
.note button {
	flex: none; font-size: 12px; font-weight: 500; text-decoration: underline; text-underline-offset: 2px;
}
.note button::after { content: ''; position: absolute; inset: -13px -6px; }
.intro { color: rgb(var(--muted)); font-size: 13px; }
.shop { display: grid; gap: 10px; justify-items: start; padding: 12px; border-radius: 14px; background: rgb(var(--subtle)); }
.log { display: flex; flex-direction: column; gap: 14px; }
.bubble {
	align-self: flex-end; max-width: 80%; padding: 10px 12px; border-radius: 16px 16px 4px 16px;
	background: rgb(var(--fg)); color: rgb(var(--bg)); white-space: pre-wrap; overflow-wrap: anywhere;
}
.answer { display: flex; gap: 10px; align-items: flex-start; }
.answer > .chip {
	display: inline-flex; align-items: center; justify-content: center; flex: none;
	width: 26px; height: 26px; border-radius: 50%; background: rgb(var(--tile));
}
.answer > .chip .mark svg { width: 12px; height: 12px; }
.card { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.answer[data-status='pending'] .card { padding: 12px; border-radius: 16px; background: rgb(var(--coral-wash)); }
.eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgb(var(--coral-ink)); }
.answer:not([data-status='pending']) .eyebrow { color: rgb(var(--muted)); }
.summary { color: rgb(var(--soft)); overflow-wrap: anywhere; }
.answer[data-status='undone'] .summary { color: rgb(var(--muted)); }
.status-line { display: flex; align-items: center; gap: 8px; color: rgb(var(--muted)); }
.failure { display: flex; align-items: flex-start; gap: 8px; color: rgb(var(--negative)); overflow-wrap: anywhere; }
.failure .icon { margin-top: 2px; }
.diff-field { display: grid; gap: 4px; }
.diff-label { font-size: 12px; font-weight: 500; color: rgb(var(--muted)); }
.diff { border-radius: 14px; overflow: hidden; box-shadow: inset 0 0 0 1px rgb(var(--hairline)); }
.diff > div { display: grid; gap: 2px; padding: 10px 12px; }
.diff .before { background: rgb(var(--negative) / .07); color: rgb(var(--negative)); }
.diff .after { background: rgb(var(--mint-wash)); color: rgb(var(--mint-ink)); }
.diff .tag { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.diff .value {
	white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical;
	-webkit-line-clamp: 6; overflow: hidden;
}
.diff .before .value { text-decoration: line-through; text-decoration-color: rgb(var(--negative) / .5); }
.diff .after .value { font-weight: 500; }
.diff .value.none { text-decoration: none; font-style: italic; font-weight: 400; color: rgb(var(--muted)); }
.more { font-size: 12px; color: rgb(var(--muted)); }
.actions { display: flex; flex-wrap: wrap; gap: 6px; }

.button {
	display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px;
	padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 500; white-space: nowrap;
}
.button::after { content: ''; position: absolute; inset: -4px 0; }
.button.primary { background: rgb(var(--fg)); color: rgb(var(--bg)); }
.button.primary:hover:not(:disabled) { background: rgb(var(--soft)); }
.button.secondary { background: rgb(var(--bg)); box-shadow: inset 0 0 0 1px rgb(var(--border-soft)); }
.button.secondary:hover:not(:disabled) { background: rgb(var(--paper)); }
.button.quiet { color: rgb(var(--soft)); padding: 0 10px; }
.button.quiet:hover:not(:disabled) { background: rgb(var(--paper)); color: rgb(var(--fg)); }
.button:disabled { background: rgb(var(--actions)); color: rgb(var(--muted)); box-shadow: none; }
.button.quiet:disabled { background: none; }

.composer { flex: none; display: grid; gap: 8px; padding: 10px 14px 12px; }
.path { display: flex; align-items: center; gap: 10px; color: rgb(var(--muted)); font-size: 13px; }
.path input {
	flex: 1; min-width: 0; height: 40px; padding: 0 14px; outline: 0; color: rgb(var(--fg));
	border: 1px solid rgb(var(--border)); border-radius: 999px; background: rgb(var(--bg));
}
.path input:focus-visible { border-color: rgb(var(--accent)); }
.bar {
	display: flex; align-items: flex-end; gap: 6px; padding: 0 0 0 14px; border-radius: 18px;
	background: rgb(var(--paper)); box-shadow: inset 0 0 0 1px rgb(var(--hairline));
}
.bar:focus-within { box-shadow: inset 0 0 0 1px rgb(var(--accent)), 0 0 0 3px rgb(var(--accent) / .18); }
.bar > .mark { height: 44px; align-items: center; }
/* The bar's ring shows focus. */
textarea:focus-visible, .search input:focus-visible { outline: none; }
textarea {
	flex: 1; min-width: 0; resize: none; min-height: 44px; max-height: 160px; padding: 12px 0;
	border: 0; outline: 0; background: transparent; line-height: 20px; color: rgb(var(--fg));
}
textarea:disabled, .path input:disabled { opacity: .6; }
.send { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: none; }
.send::before {
	content: ''; position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgb(var(--accent));
}
.send > .icon, .send > .working { position: relative; color: rgb(var(--ink)); }
.send:disabled::before { opacity: .4; }
.send .icon svg { stroke-width: 2; }
.send .working svg, .send .working .accent { fill: rgb(var(--ink)); }

.form { position: relative; flex: 1; min-height: 0; margin: 12px 14px 0; }
.form iframe {
	display: block; width: 100%; height: 100% !important; border: 0; border-radius: 12px; background: rgb(var(--subtle));
}
.form.loading iframe { visibility: hidden; }
.form-note {
	position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
	padding: 16px; text-align: center; border-radius: 12px; background: rgb(var(--subtle)); color: rgb(var(--muted));
}
.form-note.error { color: rgb(var(--negative)); }

.foot {
	display: flex; align-items: center; gap: 8px; flex: none; padding: 12px 14px;
	border-top: 1px solid rgb(var(--hairline)); background: rgb(var(--subtle));
}
.save-state { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 16px; color: rgb(var(--muted)); }
.save-state .dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: rgb(var(--warning)); }
.save-state[data-state='unsaved'] { color: rgb(var(--warning)); }
.save-state[data-state='saved'] { color: rgb(var(--positive)); }
.save-state[data-state='error'] { color: rgb(var(--negative)); }
.save-state .icon svg { width: 14px; height: 14px; }
.save-state .link { text-decoration: underline; text-underline-offset: 2px; font-weight: 500; flex: none; }
.save-state .link::after { content: ''; position: absolute; inset: -14px -6px; }

.launcher {
	position: fixed; left: 20px; bottom: 20px; z-index: 2147483647;
	display: flex; align-items: center; gap: 2px; padding: 2px; border-radius: 999px;
	background: rgb(23 22 20); color: rgb(214 211 204); box-shadow: 0 8px 24px rgb(0 0 0 / .3);
}
@media (prefers-color-scheme: dark) { .launcher { box-shadow: 0 0 0 1px rgb(255 255 255 / .12), 0 8px 24px rgb(0 0 0 / .5); } }
@media (max-width: 767px) { .launcher { left: 8px; bottom: 8px; } }
.launcher button { height: 44px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; }
.launcher button:hover { background: rgb(255 255 255 / .08); color: rgb(244 243 240); }
.launcher :focus-visible { outline-color: rgb(212 130 30); }
.launch { gap: 8px; padding: 0 12px 0 6px; color: rgb(244 243 240); font-size: 13px; font-weight: 500; }
.launch-tile, .reading .launch-tile {
	display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%;
	background: rgb(44 42 39);
}
.launch-tile .mark svg { width: 15px; height: 15px; }
.reading { display: inline-flex; align-items: center; gap: 8px; padding: 0 8px 0 6px; color: rgb(244 243 240); font-size: 13px; font-weight: 500; }
.eye { width: 44px; }
.exit { padding: 0 14px; font-size: 13px; }

.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483645; }
.box { position: absolute; border-radius: 4px; }
.box.hover { border: 1.5px dashed rgb(var(--border)); }
.box.preview { border: 2px solid rgb(var(--accent)); }
.name-tab {
	position: absolute; height: 20px; padding: 0 8px; border-radius: 6px 6px 0 0; white-space: nowrap;
	background: rgb(105 100 94); color: rgb(255 255 255); font-size: 11px; font-weight: 500; line-height: 20px;
}
.name-tab.inside { border-radius: 0 0 6px 0; }
.chips { position: absolute; display: flex; gap: 4px; }
.chips span {
	display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px;
	font-size: 12px; white-space: nowrap;
}
.chips .accent-chip { background: rgb(212 130 30); color: rgb(23 22 20); font-weight: 600; }
.chips .accent-chip .mark { color: rgb(23 22 20); }
.chips .accent-chip .mark svg { width: 11px; height: 11px; }
.chips .ink-chip { background: rgb(23 22 20); color: rgb(255 255 255); font-weight: 500; }
`

// Outlines on the page: the selection in the accent, hover drawn by the
// layer instead (only the innermost block, with its name).
const pageCss = () => {
	const block = `[${UID_ATTRIBUTE}]`
	return (
		`html[data-obelism-editor]{transition:margin-right .3s cubic-bezier(.2,.8,.2,1)}` +
		`html[data-obelism-docked]{margin-right:${DOCK_WIDTH_PX}px!important}` +
		`html[data-obelism-editor][data-cms-selecting] ${block}:hover:not([data-cms-selected]){outline:none}` +
		`html[data-obelism-editor][data-cms-selecting] ${block}[data-cms-selected]{outline:2px solid rgb(212 130 30);outline-offset:2px}` +
		`@media (prefers-reduced-motion:reduce){html[data-obelism-editor]{transition:none}}`
	)
}

// 'heroTitle', 'hero_title' → 'Hero title': block types are apiIds, and the
// site API doesn't send their names.
export const humanize = (apiId: string) => {
	const words = apiId
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.trim()
		.toLowerCase()
	return words.charAt(0).toUpperCase() + words.slice(1)
}

export type FieldDiff = { label: string; before: string; after: string }

type Leaf = { label: string; text: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value)

// Every text in a view (bridge.view()), by a path that follows blocks by
// uid, so a block moving or one added doesn't read as everything changed.
const leaves = (
	value: unknown,
	label: string,
	path: string,
	out: Map<string, Leaf>,
) => {
	if (value === null || value === undefined || value === '') return
	if (typeof value !== 'object') {
		out.set(path, { label, text: String(value) })
		return
	}
	if (Array.isArray(value)) {
		if (value.every((item) => item === null || typeof item !== 'object')) {
			if (value.length) out.set(path, { label, text: value.join(', ') })
			return
		}
		value.forEach((item, index) => {
			const uid =
				isRecord(item) && typeof item._uid === 'string' ? item._uid : index
			const type =
				isRecord(item) && typeof item._type === 'string' ? item._type : null
			leaves(item, type ? humanize(type) : label, `${path}/${uid}`, out)
		})
		return
	}
	for (const [key, child] of Object.entries(value)) {
		if (key === '_uid' || key === '_type') continue
		leaves(
			child,
			label ? `${label} · ${humanize(key)}` : humanize(key),
			`${path}/${key}`,
			out,
		)
	}
}

// What a prompt changed, from the view before and after it.
export const diffViews = (
	before: Record<string, unknown>,
	after: Record<string, unknown>,
): FieldDiff[] => {
	const was = new Map<string, Leaf>()
	const is = new Map<string, Leaf>()
	leaves(before, '', '', was)
	leaves(after, '', '', is)
	const diffs: FieldDiff[] = []
	for (const path of new Set([...was.keys(), ...is.keys()])) {
		const old = was.get(path)
		const now = is.get(path)
		if (old?.text === now?.text) continue
		diffs.push({
			label: (now ?? old)!.label,
			before: old?.text ?? '',
			after: now?.text ?? '',
		})
	}
	return diffs
}

type Answer = {
	prompt: string
	uid: string | null
	status: 'working' | 'pending' | 'kept' | 'undone' | 'failed'
	summary: string
	diffs: FieldDiff[]
	node: HTMLElement
	// What it was last drawn as: redrawn only when that changes, so the log
	// doesn't read it out again.
	drawn: string
}

const readOpen = (win: Window | null) => {
	try {
		return win?.localStorage.getItem(OPEN_KEY) !== 'minimised'
	} catch {
		return true
	}
}

// Mounts the editor on the page; returns a function that removes it.
export const mountSiteEditor = (
	doc: Document,
	bridge: ContentBridge,
	options: PromptBoxOptions = {},
) => {
	const labels: PromptLabels = { ...DEFAULT_PROMPT_LABELS, ...options.labels }
	const win = doc.defaultView
	const html = doc.documentElement

	const icon = (name: keyof typeof ICONS) => svgSpan(doc, 'icon', ICONS[name])
	const mark = () => svgSpan(doc, 'mark', MARKS.obelism)
	const working = () => svgSpan(doc, 'working', MARKS.working)
	const button = (className: string, ...children: (Node | string)[]) =>
		element(doc, 'button', { className, type: 'button' }, ...children)

	const host = element(doc, 'div')
	host.setAttribute('data-obelism-content-editor', '')
	const shadow = host.attachShadow({ mode: 'open' })
	const pageStyle = element(doc, 'style', { textContent: pageCss() })

	const tile = element(doc, 'span', { className: 'tile' }, mark())
	const pageButtonText = element(doc, 'span')
	const pageButton = button(
		'page-button hit',
		pageButtonText,
		element(doc, 'span', {
			className: 'visually-hidden',
			textContent: `, ${labels.pages}`,
		}),
		icon('chevrons'),
	)
	pageButton.setAttribute('aria-haspopup', 'listbox')
	pageButton.setAttribute('aria-expanded', 'false')
	pageButton.setAttribute('aria-controls', 'obelism-pages')
	const pageName = element(doc, 'span', { className: 'page-name' })
	const envText = element(doc, 'span')
	const env = element(
		doc,
		'span',
		{ className: 'env' },
		element(doc, 'span', {
			className: 'visually-hidden',
			textContent: `${labels.environment}: `,
		}),
		envText,
	)
	const minimise = button('icon-button hit', icon('minimise'))
	minimise.setAttribute('aria-label', labels.minimize)
	minimise.title = labels.minimize
	const head = element(
		doc,
		'div',
		{ className: 'head' },
		tile,
		pageButton,
		pageName,
		env,
		element(doc, 'span', { className: 'spacer' }),
		minimise,
	)

	const search = element(doc, 'input', {
		type: 'text',
		placeholder: labels.pagesSearch,
		autocomplete: 'off',
		spellcheck: false,
	})
	search.setAttribute('role', 'combobox')
	search.setAttribute('aria-label', labels.pagesSearch)
	search.setAttribute('aria-autocomplete', 'list')
	search.setAttribute('aria-expanded', 'true')
	search.setAttribute('aria-controls', 'obelism-pages')
	const optionList = element(doc, 'ul', {
		className: 'options',
		id: 'obelism-pages',
	})
	optionList.setAttribute('role', 'listbox')
	optionList.setAttribute('aria-label', labels.pages)
	const pagesNote = element(doc, 'p', { className: 'empty' })
	const newPage = button('button quiet new-page', icon('plus'), labels.newPage)
	const pagesBox = element(
		doc,
		'div',
		{ className: 'pages' },
		element(doc, 'label', { className: 'search' }, icon('search'), search),
		optionList,
		pagesNote,
		newPage,
	)

	const tab = (
		id: string,
		controls: string,
		...children: (Node | string)[]
	) => {
		const node = button('tab', ...children)
		node.id = id
		node.setAttribute('role', 'tab')
		node.setAttribute('aria-controls', controls)
		return node
	}
	const askTab = tab(
		'obelism-tab-ask',
		'obelism-ask',
		mark(),
		labels.modePrompt,
	)
	const fieldsTab = tab('obelism-tab-fields', 'obelism-fields', labels.form)
	const tabs = element(doc, 'div', { className: 'tabs' }, askTab, fieldsTab)
	tabs.setAttribute('role', 'tablist')
	tabs.setAttribute('aria-label', labels.modes)

	const noteText = element(doc, 'span')
	const wholePage = button('', labels.scopeEntry)
	const cancelNew = button('', labels.newPageCancel)
	const note = element(
		doc,
		'div',
		{ className: 'note' },
		icon('scope'),
		noteText,
		wholePage,
		cancelNew,
	)
	const intro = element(doc, 'p', {
		className: 'intro',
		textContent: labels.askIntro,
	})
	// A product (collection) the site marks without a page of its own.
	const shopText = element(doc, 'p', { className: 'summary' })
	const shopButton = button('button primary', icon('plus'))
	const shopButtonText = element(doc, 'span')
	shopButton.appendChild(shopButtonText)
	const shop = element(doc, 'div', { className: 'shop' }, shopText, shopButton)
	const log = element(doc, 'div', { className: 'log' })
	log.setAttribute('role', 'log')
	const scroll = element(
		doc,
		'div',
		{ className: 'scroll' },
		note,
		intro,
		shop,
		log,
	)

	const pathInput = element(doc, 'input', {
		type: 'text',
		placeholder: labels.pathPlaceholder,
		autocomplete: 'off',
		spellcheck: false,
	})
	const pathRow = element(
		doc,
		'label',
		{ className: 'path' },
		element(doc, 'span', { textContent: labels.path }),
		pathInput,
	)
	const input = element(doc, 'textarea', { rows: 1 })
	input.setAttribute('aria-label', labels.open)
	const sendIcon = icon('send')
	const sendWorking = working()
	const send = element(
		doc,
		'button',
		{ className: 'send', type: 'submit', title: labels.send },
		element(doc, 'span', {
			className: 'visually-hidden',
			textContent: labels.send,
		}),
		sendIcon,
		sendWorking,
	)
	const bar = element(doc, 'div', { className: 'bar' }, mark(), input, send)
	const composer = element(doc, 'form', { className: 'composer' }, pathRow, bar)
	const ask = element(
		doc,
		'div',
		{ className: 'ask', id: 'obelism-ask' },
		scroll,
		composer,
	)
	ask.setAttribute('role', 'tabpanel')
	ask.setAttribute('aria-labelledby', askTab.id)

	const formNote = element(doc, 'p', { className: 'form-note' })
	formNote.setAttribute('role', 'status')
	const formBox = element(doc, 'div', { className: 'form' }, formNote)
	const fields = element(
		doc,
		'div',
		{ className: 'fields', id: 'obelism-fields' },
		formBox,
	)
	fields.setAttribute('role', 'tabpanel')
	fields.setAttribute('aria-labelledby', fieldsTab.id)

	const saveState = element(doc, 'p', { className: 'save-state' })
	saveState.setAttribute('aria-live', 'polite')
	const footerActions = element(doc, 'slot')
	footerActions.name = 'actions-footer'
	const undo = button('button quiet', icon('undo'), labels.undo)
	const save = button('button secondary')
	const publish = button('button primary')
	const foot = element(
		doc,
		'div',
		{ className: 'foot' },
		saveState,
		footerActions,
		undo,
		save,
		publish,
	)

	const panel = element(
		doc,
		'aside',
		{ className: 'panel', id: 'obelism-editor' },
		head,
		pagesBox,
		tabs,
		ask,
		fields,
		foot,
	)
	panel.setAttribute('aria-label', labels.editor)

	const launch = button(
		'launch',
		element(doc, 'span', { className: 'launch-tile' }, mark()),
		labels.editing,
	)
	launch.setAttribute('aria-controls', panel.id)
	const reading = element(
		doc,
		'span',
		{ className: 'reading' },
		element(doc, 'span', { className: 'launch-tile' }, mark()),
		labels.viewingDrafts,
	)
	const eyeOn = icon('eye')
	const eyeOff = icon('eyeOff')
	const eye = button('eye', eyeOn, eyeOff)
	eye.setAttribute('aria-label', labels.hideOutlines)
	eye.title = labels.hideOutlines
	const barActions = element(doc, 'slot')
	barActions.name = 'actions-bar'
	const exit = button('exit', labels.signOut)
	const launcher = element(
		doc,
		'div',
		{ className: 'launcher' },
		launch,
		reading,
		eye,
		barActions,
		exit,
	)
	if (options.actions) host.appendChild(options.actions)

	const layer = element(doc, 'div', { className: 'layer' })
	layer.setAttribute('aria-hidden', 'true')
	const root = element(
		doc,
		'div',
		{ className: 'root' },
		layer,
		panel,
		launcher,
	)
	shadow.append(element(doc, 'style', { textContent: CSS }), root)

	let open = readOpen(win)
	let mode: 'ask' | 'fields' = 'ask'
	let creating = false
	let outlines = true
	let picking = false
	let pages: SitePage[] | null = null
	let pagesLoad: Promise<void> | null = null
	let pagesError: string | null = null
	let active = 0
	let formHandle: FormHandle | null = null
	let formLoading = false
	let formError: string | null = null
	let stored:
		| { kind: 'saved' | 'published' }
		| { kind: 'error'; action: 'save' | 'publish'; text: string }
		| null = null
	let wasUnsaved = false
	let shopMessage: { text: string; error: boolean } | null = null
	const answers: Answer[] = []
	let wide = true
	let hoverUid: string | null = null
	// Block names by uid, from the views; null when it couldn't be read.
	const names = new Map<string, string | null>()
	let destroyed = false

	const site = bridge.mode === 'site'
	const failure = (error: unknown) =>
		error instanceof Error ? error.message : String(error)
	const pending = () => answers.filter(({ status }) => status === 'pending')
	const latestPending = () => pending().slice(-1)[0] ?? null
	// Decided on while nothing else runs: undo would take the running one's
	// step.
	const decidable = () =>
		answers.some(({ status }) => status === 'working') ? null : latestPending()

	let pageNames: 'idle' | 'loading' | 'done' = 'idle'
	const nameOf = (uid: string) => {
		if (!names.has(uid) && pageNames !== 'loading') {
			names.set(uid, null)
			bridge.view({ uid }).then(
				(view) => {
					if (typeof view._type === 'string')
						names.set(uid, humanize(view._type))
					refresh()
				},
				() => {},
			)
		}
		return names.get(uid) ?? labels.block
	}
	const readNames = (value: unknown) => {
		if (Array.isArray(value)) value.forEach(readNames)
		else if (isRecord(value)) {
			if (typeof value._uid === 'string' && typeof value._type === 'string')
				names.set(value._uid, humanize(value._type))
			Object.values(value).forEach(readNames)
		}
	}
	const readPageNames = () => {
		if (pageNames !== 'idle' || bridge.entryId === null) return
		pageNames = 'loading'
		const done = () => {
			pageNames = 'done'
			refresh()
		}
		bridge.view({ uid: null }).then((view) => {
			readNames(view)
			done()
		}, done)
	}

	const currentPage = () =>
		pages?.find(({ entryId }) => entryId === bridge.entryId) ?? null
	const pageTitle = () =>
		currentPage()?.name || doc.title.trim() || labels.pages

	let frame: number | null = null
	const drawMarks = (state: BridgeState) => {
		layer.replaceChildren()
		if (!marksShown(state)) return
		const rectOf = (selector: string) => {
			const target = doc.querySelector(selector)
			const rect = target?.getBoundingClientRect()
			return rect && (rect.width || rect.height) ? rect : null
		}
		const box = (rect: DOMRect, kind: string) => {
			const node = element(doc, 'div', { className: `box ${kind}` })
			Object.assign(node.style, {
				top: `${rect.top - 3}px`,
				left: `${rect.left - 3}px`,
				width: `${rect.width + 6}px`,
				height: `${rect.height + 6}px`,
			})
			layer.appendChild(node)
		}
		const chips = (rect: DOMRect, ...nodes: HTMLElement[]) => {
			const row = element(doc, 'div', { className: 'chips' }, ...nodes)
			// Above the block, or inside its top when the screen's edge is
			// there.
			const top = rect.top - 34 < 0 ? rect.top + 6 : rect.top - 34
			Object.assign(row.style, { top: `${top}px`, left: `${rect.left - 3}px` })
			layer.appendChild(row)
		}
		const previewing = latestPending()
		const previewSelector = previewing
			? previewing.uid
				? blockSelector(previewing.uid)
				: `[${ENTRY_ATTRIBUTE}]`
			: null

		if (hoverUid && hoverUid !== state.selectedUid) {
			const rect = rectOf(blockSelector(hoverUid))
			if (rect) {
				box(rect, 'hover')
				const inside = rect.top - 23 < 0
				const tab = element(doc, 'span', {
					className: `name-tab${inside ? ' inside' : ''}`,
					textContent: nameOf(hoverUid),
				})
				Object.assign(tab.style, {
					top: `${inside ? rect.top - 1.5 : rect.top - 23}px`,
					left: `${rect.left - 3}px`,
				})
				layer.appendChild(tab)
			}
		}
		const selectedPreviewing =
			!!previewing && previewing.uid === state.selectedUid
		if (state.selectedUid) {
			const rect = rectOf(blockSelector(state.selectedUid))
			if (rect) {
				const name = nameOf(state.selectedUid)
				const accent = element(doc, 'span', { className: 'accent-chip' })
				if (selectedPreviewing) accent.appendChild(mark())
				accent.appendChild(
					doc.createTextNode(
						selectedPreviewing ? fill(labels.previewChip, { name }) : name,
					),
				)
				const page = currentPage()
				chips(
					rect,
					accent,
					...(page
						? [
								element(doc, 'span', {
									className: 'ink-chip',
									textContent: page.name,
								}),
							]
						: []),
				)
			}
		}
		if (previewSelector && !selectedPreviewing) {
			const rect = rectOf(previewSelector)
			if (rect) {
				box(rect, 'preview')
				const name = previewing!.uid ? nameOf(previewing!.uid) : pageTitle()
				const accent = element(
					doc,
					'span',
					{ className: 'accent-chip' },
					mark(),
					fill(labels.previewChip, { name }),
				)
				chips(rect, accent)
			}
		}
	}
	const scheduleMarks = () => {
		if (frame !== null || !win) return
		frame = win.requestAnimationFrame(() => {
			frame = null
			drawMarks(bridge.getState())
		})
	}

	const panelShown = (state: BridgeState) =>
		state.features.includes('prompt') && open
	const marksShown = (state: BridgeState) =>
		panelShown(state) && outlines && !creating

	const fetchPages = () => {
		pagesLoad ??= bridge.pages().then(
			(list) => {
				pages = list
				pagesError = null
				renderPages()
				refresh()
			},
			(error: unknown) => {
				pagesLoad = null
				pagesError = failure(error)
				renderPages()
				refresh()
			},
		)
		return pagesLoad
	}

	const matching = () => {
		const query = search.value.trim().toLowerCase()
		return (pages ?? []).filter(
			(page) =>
				!query ||
				page.name.toLowerCase().includes(query) ||
				page.url.toLowerCase().includes(query) ||
				`/${page.path}`.toLowerCase().includes(query),
		)
	}

	const renderPages = () => {
		const list = matching()
		active = Math.max(0, Math.min(active, list.length - 1))
		optionList.textContent = ''
		list.forEach((page, index) => {
			const option = element(
				doc,
				'li',
				{
					className: `option${index === active ? ' active' : ''}`,
					id: `obelism-page-${index}`,
				},
				element(
					doc,
					'span',
					{ className: 'option-text' },
					element(doc, 'span', { textContent: page.name }),
					element(doc, 'span', {
						className: 'option-path',
						textContent: page.url,
					}),
				),
			)
			option.setAttribute('role', 'option')
			option.setAttribute('aria-selected', String(index === active))
			if (page.status !== 'published') {
				option.appendChild(
					element(doc, 'span', {
						className: 'badge',
						textContent:
							page.status === 'draft' ? labels.pageDraft : labels.pageChanged,
					}),
				)
			}
			if (page.entryId === bridge.entryId) {
				option.setAttribute('aria-current', 'page')
				const check = icon('check')
				check.removeAttribute('aria-hidden')
				check.setAttribute('role', 'img')
				check.setAttribute('aria-label', labels.pageCurrent)
				option.appendChild(check)
			}
			option.addEventListener('click', () => choose(page))
			optionList.appendChild(option)
		})
		const activeOption = optionList.children[active]
		if (activeOption) {
			search.setAttribute('aria-activedescendant', activeOption.id)
			activeOption.scrollIntoView?.({ block: 'nearest' })
		} else {
			search.removeAttribute('aria-activedescendant')
		}
		const text = pagesError ?? (pages ? '' : labels.pagesLoading)
		pagesNote.textContent = text || (list.length === 0 ? labels.pagesEmpty : '')
		pagesNote.hidden = !pagesNote.textContent
		pagesNote.className = `empty${pagesError ? ' error' : ''}`
	}

	const drawAnswer = (answer: Answer) => {
		const { node } = answer
		const deciding = answer === decidable()
		const drawn = `${answer.status}:${deciding}`
		if (answer.drawn === drawn) return
		answer.drawn = drawn
		node.dataset.status = answer.status
		const card = element(doc, 'div', { className: 'card' })
		card.appendChild(
			element(doc, 'span', {
				className: 'visually-hidden',
				textContent: `${labels.obelism}: `,
			}),
		)
		if (answer.status === 'working') {
			card.appendChild(
				element(
					doc,
					'p',
					{ className: 'status-line' },
					working(),
					creating ? labels.creating : labels.working,
				),
			)
		} else if (answer.status === 'failed') {
			card.appendChild(
				element(
					doc,
					'p',
					{ className: 'failure' },
					icon('alert'),
					answer.summary,
				),
			)
		} else {
			const eyebrow =
				answer.status === 'pending'
					? labels.suggested
					: answer.status === 'kept'
						? labels.kept
						: labels.undone
			card.appendChild(
				element(doc, 'p', { className: 'eyebrow', textContent: eyebrow }),
			)
			if (answer.summary)
				card.appendChild(
					element(doc, 'p', {
						className: 'summary',
						textContent: answer.summary,
					}),
				)
			if (answer.status !== 'undone') {
				for (const diff of answer.diffs.slice(0, MAX_DIFFS)) {
					const value = (text: string) =>
						element(doc, 'span', {
							className: `value${text ? '' : ' none'}`,
							textContent: text || labels.emptyValue,
						})
					card.appendChild(
						element(
							doc,
							'div',
							{ className: 'diff-field' },
							element(doc, 'span', {
								className: 'diff-label',
								textContent: diff.label,
							}),
							element(
								doc,
								'div',
								{ className: 'diff' },
								element(
									doc,
									'div',
									{ className: 'before' },
									element(doc, 'span', {
										className: 'tag',
										textContent: labels.before,
									}),
									value(diff.before),
								),
								element(
									doc,
									'div',
									{ className: 'after' },
									element(doc, 'span', {
										className: 'tag',
										textContent: labels.after,
									}),
									value(diff.after),
								),
							),
						),
					)
				}
				if (answer.diffs.length > MAX_DIFFS)
					card.appendChild(
						element(doc, 'p', {
							className: 'more',
							textContent: fill(labels.moreChanges, {
								count: answer.diffs.length - MAX_DIFFS,
							}),
						}),
					)
			}
			// Only the newest suggestion is decided on; the ones before it go
			// with it when it's kept.
			if (deciding) {
				const keep = button('button primary', labels.keep)
				const retry = button('button secondary', labels.retry)
				const back = button('button quiet', labels.undo)
				keep.addEventListener('click', keepAll)
				retry.addEventListener('click', () => void tryAnother(answer))
				back.addEventListener('click', () => undoAnswer(answer))
				card.appendChild(
					element(doc, 'div', { className: 'actions' }, keep, retry, back),
				)
			}
		}
		const chip = element(doc, 'span', { className: 'chip' }, mark())
		node.replaceChildren(chip, card)
	}
	const drawAnswers = () => answers.forEach(drawAnswer)

	const render = (state: BridgeState) => {
		if (destroyed) return
		const available = state.features.includes('prompt')
		const storing = state.saving || state.publishing
		const busy = state.prompting || storing
		const shown = available && open
		const canCreate = site && state.features.includes('create')
		// A page of the site that isn't an entry (a hand-written /about) has
		// nothing to edit: only New page…
		const pageless = bridge.entryId === null
		// …unless it shows a product (collection) without a page: then that
		// first.
		const shopHere =
			!pageless || !canCreate
				? null
				: bridge.product
					? ('product' as const)
					: bridge.collection
						? ('collection' as const)
						: null
		const onlyNew =
			pageless && canCreate && !shopHere && !options.promptWithoutPage
		if (!canCreate) creating = false
		if (onlyNew) creating = true
		const hasForm =
			site && !creating && !pageless && state.features.includes('form')
		if (!hasForm) mode = 'ask'

		root.hidden = !available && !site
		panel.toggleAttribute('data-closed', !shown)
		panel.inert = !shown
		launch.hidden = !available
		launch.setAttribute('aria-expanded', String(shown))
		reading.hidden = available
		eye.hidden = !shown
		eye.setAttribute('aria-pressed', String(!outlines))
		eyeOn.hidden = !outlines
		eyeOff.hidden = outlines
		exit.hidden = options.signOut === false

		// The site beside the panel, wide enough; a sheet over it otherwise.
		html.toggleAttribute('data-obelism-docked', shown && wide)
		const selecting = shown && outlines && !creating
		if (state.selecting !== selecting) bridge.setSelecting(selecting)

		const showForm = shown && mode === 'fields'
		if (showForm && !formHandle) mountForm()
		else if (!showForm && formHandle) unmountForm()

		if (picking && !shown) picking = false
		pageButtonText.textContent = pageTitle()
		pageButton.hidden = pages === null && pagesError !== null
		pageName.hidden = !pageButton.hidden
		pageName.textContent = pageTitle()
		pageButton.setAttribute('aria-expanded', String(picking))
		pagesBox.hidden = !picking
		newPage.hidden = !canCreate || creating
		newPage.disabled = busy
		const environment = bridge.environment
		env.hidden = !environment
		env.dataset.env = environment ?? ''
		envText.textContent =
			environment === 'production' ? labels.envProduction : (environment ?? '')

		tabs.hidden = !hasForm
		askTab.setAttribute('aria-selected', String(mode === 'ask'))
		fieldsTab.setAttribute('aria-selected', String(mode === 'fields'))
		askTab.disabled = fieldsTab.disabled = busy
		askTab.tabIndex = mode === 'ask' ? 0 : -1
		fieldsTab.tabIndex = mode === 'fields' ? 0 : -1
		ask.hidden = mode !== 'ask'
		fields.hidden = mode !== 'fields'

		const offerShop = shopHere !== null && !creating
		if (creating) {
			noteText.textContent = labels.newPage
		} else if (state.selectedUid) {
			const [beforeName, afterName = ''] = labels.scopeNoteBlock.split('{name}')
			noteText.replaceChildren(
				beforeName ?? '',
				element(doc, 'strong', { textContent: nameOf(state.selectedUid) }),
				afterName,
			)
		} else {
			noteText.textContent = labels.scopeNotePage
		}
		note.hidden =
			offerShop || (pageless && !creating && !options.promptWithoutPage)
		wholePage.hidden = creating || !state.selectedUid
		cancelNew.hidden = !creating || onlyNew
		intro.hidden = answers.length > 0 || offerShop || creating
		shop.hidden = !offerShop
		const shopCopy =
			shopHere === 'collection'
				? {
						add: labels.addCollectionPage,
						adding: labels.addingCollectionPage,
						hint: labels.collectionPageHint,
					}
				: {
						add: labels.addProductPage,
						adding: labels.addingProductPage,
						hint: labels.productPageHint,
					}
		shopButtonText.textContent =
			state.prompting && offerShop ? shopCopy.adding : shopCopy.add
		shopButton.disabled = busy
		shopText.textContent = shopMessage?.text ?? shopCopy.hint
		shopText.className = shopMessage?.error ? 'failure' : 'summary'

		composer.hidden = offerShop
		pathRow.hidden = !creating
		pathInput.disabled = busy
		input.placeholder = creating
			? labels.newPagePlaceholder
			: labels.placeholder
		input.disabled = busy
		send.disabled =
			busy ||
			input.value.trim() === '' ||
			(creating && pathInput.value.trim() === '')
		send.setAttribute('aria-busy', String(state.prompting))
		sendIcon.hidden = state.prompting
		sendWorking.hidden = !state.prompting

		const waiting = pending().length > 0
		undo.hidden = waiting || !state.canUndo || creating
		undo.disabled = busy
		save.hidden = !state.features.includes('save') || pageless
		save.disabled = busy || waiting || !state.unsaved
		save.textContent = labels.saveDraft
		publish.hidden = !state.features.includes('publish') || pageless
		publish.disabled = busy || waiting
		publish.textContent = labels.publish
		if (options.actions)
			options.actions.slot = shown ? 'actions-footer' : 'actions-bar'
		foot.hidden = !site

		// New changes make the last save's word stale.
		if (state.unsaved && !wasUnsaved) stored = null
		wasUnsaved = state.unsaved
		const saveIcon: Node | null = storing
			? working()
			: stored?.kind === 'error'
				? icon('alert')
				: waiting || state.unsaved
					? element(doc, 'span', { className: 'dot' })
					: icon('check')
		const saveText = state.saving
			? labels.saving
			: state.publishing
				? labels.publishing
				: stored?.kind === 'error'
					? `${stored.action === 'save' ? labels.saveFailed : labels.publishFailed}: ${stored.text}`
					: waiting
						? labels.keepFirst
						: state.unsaved
							? labels.unsaved
							: stored?.kind === 'saved'
								? labels.saved
								: stored?.kind === 'published'
									? labels.published
									: labels.upToDate
		saveState.dataset.state = storing
			? 'saving'
			: stored?.kind === 'error'
				? 'error'
				: waiting || state.unsaved
					? 'unsaved'
					: 'saved'
		saveState.replaceChildren(
			...(saveIcon ? [saveIcon] : []),
			element(doc, 'span', { textContent: saveText }),
		)
		if (stored?.kind === 'error' && !storing) {
			const action = stored.action
			const retry = button('link', labels.tryAgain)
			retry.addEventListener('click', () => void store(action))
			saveState.appendChild(retry)
		}

		formBox.classList.toggle('loading', formLoading || formError !== null)
		formNote.hidden = !formLoading && formError === null
		formNote.className = `form-note${formError !== null ? ' error' : ''}`
		formNote.textContent = formError ?? labels.formLoading

		if (shown) {
			readPageNames()
			if (pages === null && pagesError === null) void fetchPages()
		}
		scheduleMarks()
	}
	const refresh = () => render(bridge.getState())

	const mountForm = () => {
		formLoading = true
		formError = null
		const handle = bridge.openForm(formBox, {
			title: labels.formTitle,
			onReady: () => {
				if (formHandle !== handle) return
				formLoading = false
				refresh()
			},
			onError: (text) => {
				if (formHandle !== handle) return
				formLoading = false
				formError = text
				refresh()
			},
		})
		formHandle = handle
	}
	const unmountForm = () => {
		formHandle?.close()
		formHandle = null
		formLoading = false
		formError = null
	}

	const grow = () => {
		input.style.height = 'auto'
		input.style.height = `${input.scrollHeight}px`
	}
	const scrollDown = () => {
		scroll.scrollTop = scroll.scrollHeight
	}

	const remember = () => {
		try {
			win?.localStorage.setItem(OPEN_KEY, open ? 'open' : 'minimised')
		} catch {}
	}
	const setOpen = (next: boolean) => {
		open = next
		remember()
		if (!open) picking = false
		refresh()
		if (open) {
			;(mode === 'fields' ? fieldsTab : creating ? pathInput : input).focus()
		} else {
			launch.focus()
		}
	}

	const setMode = (next: 'ask' | 'fields', focus = true) => {
		if (mode === next) return
		// The form edits what's on the page: what Obelism suggested becomes
		// the base, so undo stays the form's.
		if (next === 'fields') keepAll()
		mode = next
		refresh()
		if (focus) (next === 'ask' ? askTab : fieldsTab).focus()
	}

	const setCreating = (next: boolean) => {
		creating = next
		picking = false
		if (creating) bridge.select(null)
		refresh()
		;(creating ? pathInput : input).focus()
	}

	const setPicking = (next: boolean) => {
		picking = next
		if (picking) {
			search.value = ''
			active = Math.max(
				0,
				(pages ?? []).findIndex(({ entryId }) => entryId === bridge.entryId),
			)
			void fetchPages()
			renderPages()
		}
		refresh()
		;(picking ? search : pageButton).focus()
	}

	const choose = (page: SitePage) => {
		if (page.entryId === bridge.entryId) return setPicking(false)
		// Asks first when changes aren't saved; stays here if told no.
		bridge.openPage(page)
	}

	const keepAll = () => {
		const waiting = pending()
		if (!waiting.length || !decidable()) return
		waiting.forEach((answer) => {
			answer.status = 'kept'
		})
		drawAnswers()
		refresh()
		input.focus()
	}

	const undoAnswer = (answer: Answer) => {
		if (answer !== decidable()) return
		bridge.undo()
		answer.status = 'undone'
		drawAnswers()
		refresh()
		input.focus()
	}

	const addAnswer = (prompt: string, uid: string | null) => {
		const answer: Answer = {
			prompt,
			uid,
			status: 'working',
			summary: '',
			diffs: [],
			node: element(doc, 'div', { className: 'answer' }),
			drawn: '',
		}
		answers.push(answer)
		drawAnswer(answer)
		log.appendChild(answer.node)
		return answer
	}

	// Runs a prompt on `uid` (null: the page) and shows what it changed. The
	// change is on the page straight away (the bridge's unsaved content):
	// that is the preview, until it's kept or undone.
	const runPrompt = async (answer: Answer, text: string) => {
		const scope = { uid: answer.uid }
		const before = await bridge.view(scope).catch(() => null)
		try {
			const { summary } = await bridge.prompt(text, scope)
			const after = before ? await bridge.view(scope).catch(() => null) : null
			answer.summary = summary
			answer.diffs = before && after ? diffViews(before, after) : []
			answer.status = 'pending'
		} catch (error) {
			answer.summary = failure(error)
			answer.status = 'failed'
		}
		drawAnswers()
		refresh()
		scrollDown()
	}

	const tryAnother = async (answer: Answer) => {
		if (answer !== decidable()) return
		bridge.undo()
		answer.status = 'undone'
		const next = addAnswer(answer.prompt, answer.uid)
		drawAnswers()
		refresh()
		scrollDown()
		input.focus()
		await runPrompt(next, fill(labels.retryPrompt, { prompt: answer.prompt }))
	}

	const submit = async () => {
		const prompt = input.value.trim()
		const state = bridge.getState()
		if (!prompt || state.prompting) return
		const path = pathInput.value.trim()
		if (creating && !path) return pathInput.focus()
		const uid = creating ? null : state.selectedUid
		const scopeName = creating
			? `${labels.newPage} · ${path}`
			: uid
				? nameOf(uid)
				: labels.scopeEntry
		log.appendChild(
			element(
				doc,
				'p',
				{ className: 'bubble' },
				element(doc, 'span', {
					className: 'visually-hidden',
					textContent: `${labels.you} (${scopeName}): `,
				}),
				prompt,
			),
		)
		input.value = ''
		grow()
		const answer = addAnswer(prompt, uid)
		refresh()
		scrollDown()
		if (creating) {
			try {
				// The bridge opens the new page; this shows until it does.
				await bridge.createPage(path, prompt)
				pages = null
				pagesLoad = null
				answer.summary = labels.created
				answer.status = 'kept'
			} catch (error) {
				answer.summary = failure(error)
				answer.status = 'failed'
			}
			drawAnswers()
			refresh()
		} else {
			await runPrompt(answer, prompt)
		}
		input.focus()
	}

	const store = async (action: 'save' | 'publish') => {
		stored = null
		try {
			await bridge[action]()
			stored = { kind: action === 'save' ? 'saved' : 'published' }
		} catch (error) {
			stored = { kind: 'error', action, text: failure(error) }
		}
		refresh()
	}

	const addShopPage = async () => {
		shopMessage = null
		try {
			// The bridge reloads the page; this shows until it does.
			if (bridge.product) {
				await bridge.createProductPage()
				shopMessage = { text: labels.addedProductPage, error: false }
			} else {
				await bridge.createCollectionPage()
				shopMessage = { text: labels.addedCollectionPage, error: false }
			}
		} catch (error) {
			shopMessage = { text: failure(error), error: true }
		}
		refresh()
	}

	launch.addEventListener('click', () => setOpen(!open))
	minimise.addEventListener('click', () => setOpen(false))
	eye.addEventListener('click', () => {
		outlines = !outlines
		refresh()
	})
	exit.addEventListener('click', () => bridge.signOut())
	pageButton.addEventListener('click', () => setPicking(!picking))
	newPage.addEventListener('click', () => setCreating(true))
	cancelNew.addEventListener('click', () => setCreating(false))
	wholePage.addEventListener('click', () => {
		bridge.select(null)
		input.focus()
	})
	shopButton.addEventListener('click', () => void addShopPage())
	askTab.addEventListener('click', () => setMode('ask'))
	fieldsTab.addEventListener('click', () => setMode('fields'))
	tabs.addEventListener('keydown', (event) => {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
		event.preventDefault()
		const next =
			event.key === 'Home'
				? 'ask'
				: event.key === 'End'
					? 'fields'
					: mode === 'ask'
						? 'fields'
						: 'ask'
		setMode(next)
	})
	undo.addEventListener('click', () => {
		bridge.undo()
		if (undo.hidden) input.focus()
	})
	save.addEventListener('click', () => void store('save'))
	publish.addEventListener('click', () => void store('publish'))
	composer.addEventListener('submit', (event) => {
		event.preventDefault()
		void submit()
	})
	input.addEventListener('input', () => {
		grow()
		refresh()
	})
	input.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault()
			void submit()
		}
	})
	pathInput.addEventListener('input', refresh)
	pathInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault()
			input.focus()
		}
	})
	search.addEventListener('input', () => {
		active = 0
		renderPages()
	})
	search.addEventListener('keydown', (event) => {
		const count = optionList.children.length
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			if (count === 0) return
			active = (active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
			renderPages()
		} else if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault()
			const page = matching()[active]
			if (page) choose(page)
		} else if (event.key === 'Escape') {
			event.preventDefault()
			setPicking(false)
		}
	})

	// Escape steps back: from the pages, from a block to the whole page.
	const onKeydown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape' || event.defaultPrevented) return
		const state = bridge.getState()
		if (!panelShown(state)) return
		if (picking) {
			event.preventDefault()
			setPicking(false)
		} else if (state.selectedUid) {
			event.preventDefault()
			bridge.select(null)
		}
	}
	doc.addEventListener('keydown', onKeydown)

	const onPointerOver = (event: PointerEvent) => {
		const target = event.target as Element | null
		const block = target?.closest?.(`[${UID_ATTRIBUTE}]`)
		const uid = block?.getAttribute(UID_ATTRIBUTE) ?? null
		if (uid === hoverUid) return
		hoverUid = uid
		scheduleMarks()
	}
	const onPointerLeave = () => {
		hoverUid = null
		scheduleMarks()
	}
	doc.addEventListener('pointerover', onPointerOver)
	html.addEventListener('pointerleave', onPointerLeave)
	win?.addEventListener('scroll', scheduleMarks, {
		capture: true,
		passive: true,
	})
	win?.addEventListener('resize', scheduleMarks)
	const Mutations = (win as (Window & typeof globalThis) | null)
		?.MutationObserver
	const mutations =
		typeof Mutations === 'function' ? new Mutations(scheduleMarks) : null
	mutations?.observe(doc.body, { childList: true, subtree: true })
	// The page reflows as the panel docks.
	const Resizes = (win as (Window & typeof globalThis) | null)?.ResizeObserver
	const resizes =
		typeof Resizes === 'function' ? new Resizes(scheduleMarks) : null
	resizes?.observe(html)

	const query = win?.matchMedia?.(DOCK_QUERY) ?? null
	wide = query?.matches ?? true
	const onQuery = () => {
		wide = query?.matches ?? true
		refresh()
	}
	query?.addEventListener?.('change', onQuery)

	const unsubscribe = bridge.on('change', render)
	html.setAttribute('data-obelism-editor', '')
	doc.head.appendChild(pageStyle)
	doc.body.appendChild(host)
	refresh()

	return () => {
		destroyed = true
		unsubscribe()
		unmountForm()
		if (frame !== null) win?.cancelAnimationFrame?.(frame)
		doc.removeEventListener('keydown', onKeydown)
		doc.removeEventListener('pointerover', onPointerOver)
		html.removeEventListener('pointerleave', onPointerLeave)
		win?.removeEventListener('scroll', scheduleMarks, { capture: true })
		win?.removeEventListener('resize', scheduleMarks)
		query?.removeEventListener?.('change', onQuery)
		mutations?.disconnect()
		resizes?.disconnect()
		bridge.setSelecting(false)
		html.removeAttribute('data-obelism-editor')
		html.removeAttribute('data-obelism-docked')
		pageStyle.remove()
		host.remove()
	}
}
