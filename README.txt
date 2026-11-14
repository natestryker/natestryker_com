Hello, these are the files for natestryker.com

Pages use directory URLs, such as /about/, /creations/, /league/ and /RiftGuessr/.
Edit each directory's index.html. The older .html files are compatibility redirects
that preserve bookmarked query strings and fragments. Explicit /index.html URLs
are normalized in the browser by assets/clean-urls.js.

Preview by serving the repository root over HTTP so shared assets and tracker data
resolve correctly. GitHub Pages publishes the same directory layout.

Routing and tracker checks:
node --test scripts/site-routes.test.mjs scripts/league/*.test.mjs
