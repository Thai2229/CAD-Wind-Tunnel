# Deployment

The site is a static Vite build hosted on Vercel. There is no server yet, so a deploy is just the contents of `dist`.

## Branches

- `features`: where finished work lands first. Vercel builds a preview for every push.
- `staging`: the pre-release copy. Merge `features` into it when you want a stable URL to test on.
- `prod`: what the public sees. Merge `staging` into it to release.
- `main`: the default branch on GitHub, kept in step with `prod` for now.

Work moves one way: a topic branch, then a PR into `features`, then `staging`, then `prod`. CI (lint, tests, build) runs on every PR and on pushes to all four branches. Protect `staging` and `prod` in GitHub so they only accept PRs with passing CI.

## Connecting Vercel

This needs your Vercel account, so it is a manual step.

1. In Vercel choose Add New, then Project, and import `Thai2229/CAD-Wind-Tunnel`.
2. Leave the framework as Vite. `vercel.json` already sets the build command and the `dist` output folder.
3. Under Settings, Git, set the Production Branch to `prod`.
4. Under Settings, Domains, add a staging domain (for example `staging.yourdomain.com`) and assign it to the `staging` branch. Without a custom domain, use the stable branch URL Vercel gives `staging`.
5. Leave preview deployments on, so `features` and topic branches get their own URLs.

Vercel's preview toolbar loads a script from `vercel.live`, which the page's content security policy blocks. That only adds a console message on preview URLs.

## Environments and the S3 plan

Nothing is stored today. When saved models arrive, the design is:

- One S3 bucket per environment (`cad-wind-tunnel-staging`, `cad-wind-tunnel-prod`), private, with public access blocked and encryption on. Preview and `staging` deploys use the staging bucket. Only `prod` uses the production bucket. Set this in Vercel under Environment Variables, scoped to Preview and Production separately.
- The browser never gets AWS keys. A small Vercel function, after checking the user is signed in, returns a presigned upload URL that expires in a few minutes and is limited to one object key, a size cap and an allowed content type. The browser then uploads straight to S3.
- Object keys are `users/<user id>/<model id>/<file name>`, so one user can never guess another's path.
- The bucket needs a CORS rule that allows `PUT` and `GET` only from the site's own origins. The CSP `connect-src` has to list the bucket's origin at the same time.
- Vercel reaches AWS through OIDC and an IAM role, not stored keys. Give each role access to its own bucket only.
- Postgres holds the user, model and run records, and S3 holds the files. The same split applies to staging and production.
- Models and results get a lifecycle rule that expires them after a set time, until accounts and retention are decided.

`.env.example` lists the placeholder variable names.

## STEP and IGES worker

The STEP/IGES reader runs in a module worker built to `dist/assets/cadParse.worker-<hash>.js`. `vercel.json` gives that file its own `Content-Security-Policy` (`script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'`) because the library needs `eval`, while the page's policy stays free of `'unsafe-eval'`. If the worker file is renamed or moved, update the `source` pattern in `vercel.json`. Any new host that serves the site must send the same header for that path.
