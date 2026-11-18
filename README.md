# Family Rewards

A responsive family rewards app for tracking daily activities, points, money, and monthly settlements. Family members share the same accounts and records across mobile and desktop.

[Visit the website](https://ellie-rewards.duckdns.org) · [Mobile preview](docs/previews/mobile.png) · [Desktop preview](docs/previews/desktop.png)

Deployment and access verification history is documented in the [delivery report](docs/delivery-report.md). Previews use isolated demo data.

## Features

- Parent administrator accounts and a member account, with access based on role.
- Custom activity types with money and point values, plus activity counts, dates, reasons, and confirmations.
- Monthly summaries confirmed by the member and an administrator before updating both wallets. Creating a record counts as the creator's confirmation.
- Separate monthly caps for rewards and deductions, support for negative money balances, and traceable wallet entries.
- Corrections linked to the original activity, with separate adjustments for settled records.
- Record deletion by the creator before another member confirms, with an audit trail. Confirmation closes further discussion while preserving earlier messages.
- A test-paper skip costing 10 settled points, available once per calendar month when the balance is sufficient.
- Separate money and point views, history filters, activity timelines, and manual consistent backups.
- A shared activity rule catalogue, agreement PDF preview, and original Word document download.

Wallets start at zero. A reward store, image uploads, external redemptions, online rule publishing, and automated tasks are outside the current scope.

The interface uses warm white and coral accents, with bottom navigation on mobile and a sidebar on desktop. The dashboard shows settled balances, pending changes, confirmations, and recent activity.

## Tech Stack

Node.js 24.16.0, TypeScript, Next.js 16.4.2, React 19.3.1, Tailwind CSS, shadcn/ui-style components, Prisma 7.10.1, and SQLite. Dependencies are locked in `package-lock.json`; Docker base images are pinned by digest. Deployment uses Docker Compose on an Oracle ARM64 server.

## Development

```sh
nvm use
npm ci
npm test
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

See the [runbook](docs/runbook.md) for local setup, starting the app, account maintenance, Docker deployment, certificates, and backups. Local and production environments use separate configuration. Credentials, tokens, databases, and backups must stay out of Git.

## Documentation

The following documents are currently maintained in Chinese:

- [Product design](docs/product-design.md)
- [Development design](docs/development-design.md)
- [Requirements decisions and record model](docs/open-questions.md)
- [Operations runbook](docs/runbook.md)
- [Delivery report](docs/delivery-report.md)
- [Source and test mapping](docs/source-test-map.md)
- [Development execution graph](docs/todos/FR-001/execution-map.json)

Initial production passwords are stored only in `/opt/family-rewards/secrets/credentials.txt` on the server. Retrieve them through a trusted SSH session with `sudo`; do not share them in public conversations.
