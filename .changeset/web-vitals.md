---
'@obelism/numbers-sdk': minor
---

`autoTrack({ webVitals: true })` sends a `web_vital` event per Core Web Vital (LCP, INP, CLS, FCP and TTFB, with their rating and element), which Numbers' Web vitals report shows at the 75th percentile by route and release. `release` names the deploy, so the report tells which one made a metric slower, and `sampleRate` (0 to 1) reports only that part of the visits, decided once per tab and sent as `sample`. `web-vitals` comes with the package in its own chunk, so a site that leaves it out downloads nothing extra; a script-tag site passes its own `load`. `numbers.webVitals(options)` starts them without the other autoTrack listeners.

The script-tag build grows by about 1.9 kB minified (0.7 kB brotli), its `size` budget raised with it.
