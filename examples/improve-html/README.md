# Obelism Improve HTML Example

This example is utilizing the base [Improve JS SDK](https://improve.obelism.studio/docs/sdk/javascript). There is no server logic executing, just the moment the JS mounts in the browser it will show the control or variation.

This works great for static files on a CDN without any server side logic. The downside is that there is always CLS when the AB test is being triggered on data that is visible above the fold. This is solvable by running Improve on the server.
