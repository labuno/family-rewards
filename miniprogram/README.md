# Family Rewards — WeChat Mini Program

A native WeChat client for the same family accounts, records, money, points, and monthly settlements as the Web app. The backend stays in Next.js; there is no second database or cloud-function deployment.

## Included

- Account/password sign-in, persistent sessions, and sign-out.
- Parent member switching and administrator-only initial period setup.
- Dashboard, settled wallets, pending confirmations, and separate monthly bonus status.
- Money/point activity history with type, status, period, and pagination filters.
- Activity recording with grades, scores, school terms, shout targets, and server-calculated previews.
- Confirmation, discussion, deletion before another member confirms, linked reversals, and timelines.
- Built-in/custom activity types and administrator creation of fixed-value types.
- Monthly summary generation, stale-summary warnings, confirmations, and one-time wallet posting.
- Authenticated PDF/Word agreement download and preview.

The app serves one household. WeChat account binding, payments, subscriptions, and multi-household registration are outside this version.

## Run locally

1. At the repository root, follow [`docs/runbook.md`](../docs/runbook.md) to configure an isolated local database, apply migrations, and create test accounts. Do not use production credentials or data for development. If you already have a local development database, use it.
2. Start the backend with `npm run dev -- --hostname 127.0.0.1 --port 3100`.
3. Install WeChat Developer Tools and import **this `miniprogram/` directory**, which contains `project.config.json`.
4. The project uses `touristappid` for guest development. Tool versions/account settings may require registering and entering your own AppID. AppSecret is never needed in the client.
5. For local HTTP simulator debugging, turn off server-domain/TLS/HTTPS certificate verification in the developer tool's **local settings**. This is a development-only setting, not a release configuration. The committed project retains URL checking.
6. Log in using an existing local family account. On a new database, an administrator must choose the agreement-period start date first.

`config.js` is the only API host setting. Its default is `http://127.0.0.1:3100`. A physical phone cannot reach your Mac through that loopback address. For device tests, use a reachable development server and the domain configuration appropriate for that environment.

## Shared API

All calls use `/api/mini`. Responses are private and not cached. Login returns the existing database session token; subsequent requests send `Authorization: Bearer <token>`. The client stores the token, never the password. Expired/revoked sessions return `401` and reopen the login page.

GET requests select a `resource`:

| Resource      | Parameters / result                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `dashboard`   | Optional `subject`; actor, accessible members, setup state, wallets, period, preview, pending/recent records     |
| `history`     | Optional `subject`, `asset=MONEY\|POINTS`, `type`, `status`, `period`, `page`; 20 records per page and `hasMore` |
| `types`       | Optional `asset`; built-in/custom types and current rules                                                        |
| `preview`     | `type`, `quantity`, and exam `grade` or `score`; money/point impact                                              |
| `event`       | `id`; record, timeline, impact, and available actions                                                            |
| `settlements` | Optional `subject`; monthly summaries                                                                            |
| `settlement`  | `id`; snapshot, approvals, stale state, and available actions                                                    |
| `agreement`   | `format=pdf\|docx`; authenticated file bytes                                                                     |

POST requests contain JSON with `action`:

- `login`: `username`, `password`; returns `user` and `token`.
- `logout`: revokes the current session.
- `setup`: `anchor` (`YYYY-MM-DD`).
- `create-type`: `name`, integer `money` (cents), integer `points`.
- `record`: `subjectId`, `type`, ISO `occurredAt` with timezone, integer `quantity`, `reason`, `requestKey`, optional `source`, and `evidence` object. Evidence contains exam `grade`/`score`/`schoolYear` or `shoutTarget` when applicable.
- `decide`: `eventId`, `decision=CONFIRM|DISPUTE`, `requestKey`, and a `reason` for disputes.
- `delete-event`: `eventId`.
- `reverse`: `eventId`, `reason`, `requestKey`.
- `generate`: `subjectId`, `start` (agreement-period start).
- `confirm-summary` / `post`: summary `id`.

The actor is always derived from the server session. Money is transmitted as integer cents; the client displays yuan. Activity times use Beijing time. The client retains a submission key when a request fails, so retrying the same activity does not create another record. Existing service rules govern confirmation, deletion, reversal, and atomic settlement.

## Verify

Run from the repository root:

```sh
npm test
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

The new tests execute actual mini-program page JavaScript with a simulated `wx` adapter. The HTTP integration test connects those pages to a real local Next.js server and verifies Web reads and confirmations against the same database. It uses the ignored `data/browser.db` test database.

These checks do not compile or render WXML in WeChat. Developer-tool compilation, visual layout, physical-device navigation, and real file preview must still be verified in WeChat. This checkout has no registered AppID and the development machine has no WeChat Developer Tools installed.

## Before release

1. Register the intended AppID and confirm the account's service category and publishing requirements.
2. Deploy this branch's backend to the intended server; the existing production Web backend does not gain `/api/mini` until that code is deployed.
3. Set `config.js` to the intended HTTPS host and configure request/download server domains in the WeChat console. Confirm filing and certificate requirements there; the current Web domain is not automatically approved for mini programs.
4. Enter the AppID in `project.config.json`, keep URL checking enabled, and verify all role-based flows in developer tools and on a device.
5. Test activity retry, stale summaries, shared Web changes, PDF/Word opening, logout, and session expiry before uploading an experience build or submitting for review.

No production deployment or WeChat submission is performed by the local test commands. Keep AppSecret, passwords, production databases, and agreement originals outside the client and Git.

Reference: [WeChat project structure](https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html), [wx.request](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html), [network configuration](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html).
