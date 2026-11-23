# Running the Price Space demo on your own machine

This starts the application and a demo database with one command. It is for
looking at the product. It is not an installation.

## You need

Docker Desktop (or Docker Engine with the Compose plugin). Nothing else.

## Start it

From this folder:

```
docker compose up --build
```

The first run takes a few minutes: it builds the application, creates the
database, loads the schema and about 900 demo quotes, and creates two logins.
The demo data is the same on every machine, so the numbers below will match what
you see on a fresh install. Prices are compared against the last twelve months of
quote history, and the demo history is dated relative to the day you install it.
The targets therefore drift by a few cents as the weeks pass, and after about six
months there is no history left to compare against.
Wait for the line `Price Space API listening`, then open:

**http://localhost:4173**

Only your own machine can open that address.

## Sign in

| Who | Email | Password | Can edit approval margins |
|---|---|---|---|
| Administrator | `admin@pricespace.demo` | `DemoAdmin-2026!` | Yes |
| Sales rep | `rep@pricespace.demo` | `DemoRep-2026!x` | No, read only |

## A two-minute tour

1. **Quotes, then Create Quote.** Choose any customer.
2. **Upload request.** Choose `demo/sample-quote-request.csv` from this folder.
   Five lines come back priced, each with a floor, target and ceiling. The first
   line, `PROD-HIER-0002`, should show a target of about $232.
   To try the real Channel Partners layout instead, upload
   `demo/sample-channel-partners-export.tsv`: a tab-separated file with the
   export's 101 columns and invented values. Its amounts are in EUR, one line is
   marked deleted and left out, and each line keeps its Channel Partners item ID.
3. **Click "why"** on a line to see how its numbers were worked out.
4. **Change the unit price** on the first line to 190. Its margin drops to 24.0%,
   under the 30% minimum, so the line is flagged as needing approval and the
   quote header counts it.
5. **Pricing Management, then Approval Margins.** This is the editable table of
   minimum margins. It holds a 30% placeholder until ITT's figures are loaded.
6. **Sign in as the sales rep** to see the same table with no editing controls.

## Stop it

```
docker compose down        # stop, keep the database
docker compose down -v     # stop and delete the database
```

## What this is not

Everything below is fixed and public, so none of it should be reused anywhere
that matters.

- The session secret and both passwords are written in `docker-compose.yml`.
- The application connects to the database as its superuser. A real install uses
  a least-privilege role; see `README.md` and `db/README.md`.
- The image keeps development dependencies because the server runs through
  `tsx`. A production image would not.
- All data is sample data. None of it is ITT's.

For a real installation follow `README.md`.

## If something goes wrong

- **Port already in use.** Change `4173` on the `ports:` line of
  `docker-compose.yml` to a free port.
- **The page loads but sign-in does nothing.** Run `docker compose logs app`.
- **Start again from scratch.** `docker compose down -v`, then
  `docker compose up --build`.
