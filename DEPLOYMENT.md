# Hosting and future edits

GitHub holds the editable source. The application needs a server, D1 database, R2 media storage, authenticated account identity, and secret runtime settings. GitHub Pages only serves static content and cannot run this publishing backend.

## Current hosted site

Retain the exact project ID in `.openai/hosting.json` when updating the current site. Use the Sites source workflow to push the selected source revision, build and package that same revision, save it, and deploy it. Preserve the existing access policy, D1/R2 bindings, and production encryption key. Changes made only on GitHub do not automatically synchronize or deploy to Sites.

The existing site URL is retained so saved OAuth callback URLs, social connections, and the installed publishing plugin keep their existing addresses. Its displayed title and browser branding are ekklo.

## Validation on GitHub

`.github/workflows/checks.yml` installs the lockfile, checks types, runs isolated integration checks, and builds. It checks source changes; it does not deploy or receive production credentials.

## A future move to another host

A separate Cloudflare Workers deployment is possible, but needs provisioned D1/R2 resources, a real authentication replacement for the trusted Sites identity headers, secure runtime secrets, OAuth redirect updates, and a database/media migration. Do not trust caller-supplied identity headers on an unprotected public Worker. A Cloudflare Cron Trigger also needs an actual `scheduled()` handler, verified account enrollment, and deployment configuration. A cron expression in a README or a static GitHub Pages deployment does not create a working publisher.

Do not point a new Worker at an empty database and assume existing posts or encrypted connections have moved. Export/import and verify them before any host switch. The current implementation keeps the working host and connections in place.
