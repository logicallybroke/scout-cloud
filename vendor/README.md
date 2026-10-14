# vendor/

`scout-core-0.0.0.tgz` is `@scout/core` built from `scout-js` at commit `5089b66` (branch `release-a-d1`) with
`npm pack -w @scout/core`. It is installed as a `file:` dependency so the hosted D1 cloud runs the same
`readScoutRequest`, `readDecision` and workflow shape checks as the browser, without a published package
(`docs/CLOUD_DESIGN.md` §10.2).

To update: in `scout-js`, `npm run build && npm pack -w @scout/core --pack-destination ../scout-cloud/vendor`,
then here `npm install ./vendor/scout-core-0.0.0.tgz`, and change the commit above. Replaced by a pinned
registry version once `@scout/core` is published.
