# kleinanzeigen-repost

A small Python CLI that takes one existing [Kleinanzeigen](https://www.kleinanzeigen.de)
listing and re-publishes it as a fresh duplicate ad — the classic "repost to
jump back to the top of the search results" workflow.

It does this by talking to the **same internal REST API the official
Kleinanzeigen Android/iOS apps use** (the eBay Classifieds Group "Capi"). There
is no official public documentation anymore, but the API is fully
reverse-engineered. The request flow here is a faithful port of
[`tejado/ebk-client`](https://github.com/tejado/ebk-client) (see also
[this gist](https://gist.github.com/BastelPichi/43e441f166fcd6a4c76f875dcbb91d5c)).

> ⚠️ Automated reposting is against Kleinanzeigen's terms of service and they
> rate-limit / fingerprint clients. This is a personal tool — one repost per
> invocation, no built-in loop. Use it sparingly and at your own risk.

## How the API works

- **Host:** `https://api.ebay-kleinanzeigen.de/api`
- **Partner auth (hardcoded in the app):** `Authorization: Basic …` plus the
  `X-EBAYK-APP`, `X-ECG-USER-VERSION`, `X-ECG-USER-AGENT` and `User-Agent`
  headers. These belong to the app itself, not to you; the known values are the
  defaults in `client.py`, overridable via env vars if they ever rotate.
- **User login:** `GET /users/login` with
  `X-ECG-Authorization-User: email="…",password="<base64(sha1(pw))>"` → the
  session token comes back in the **`X-EBAYK-TOKEN` response header**. Every
  later call sends `…token="<token>"` instead.
- **Read an ad:** `GET /ads/{id}` (XML).
- **Upload an image:** `POST /pictures.json` (multipart) → picture links.
- **Create an ad:** `POST /users/{email}/ads.json`, `Content-Type: application/xml`.
- **Delete an ad:** `DELETE /users/{email}/ads/{id}`.

### Repost flow

1. `GET /ads/{id}` → the source ad's full XML.
2. Strip server-managed fields (id, dates, status, …).
3. **Download every source image and re-upload it** via `POST /pictures.json`
   (the originals' CDN URLs are not reused), then splice the new picture links
   into the ad XML.
4. `POST /users/{email}/ads.json` → the new ad.

## Install

```bash
cd apps/kleinanzeigen-repost
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # then fill in KA_EMAIL / KA_PASSWORD
```

## Usage

```bash
# Repost by ad id or by full listing URL:
ka-repost 2961234567
ka-repost "https://www.kleinanzeigen.de/s-anzeige/holztisch/2961234567-217-1234"

# Non-destructive check: logs in, fetches the ad, verifies its images are
# downloadable, prints the XML. Uploads nothing and creates nothing.
ka-repost 2961234567 --dry-run

# Repost and remove the old listing afterwards:
ka-repost 2961234567 --delete-original
```

Credentials are read from environment variables or a local `.env`:

| Variable      | Required | Meaning                         |
|---------------|----------|---------------------------------|
| `KA_EMAIL`    | yes      | your Kleinanzeigen account email |
| `KA_PASSWORD` | yes      | your account password            |
| `KA_APP_*`    | no       | partner-app overrides (see `.env.example`) |

## Tests

```bash
python -m pytest
```

The tests are fully offline (id/URL parsing, XML sanitizing, picture-element
rebuilding) and run against `tests/fixtures/sample_ad.xml` — no network or
credentials needed.

## Known unknowns / first live run

The exact JSON shape returned by `POST /pictures.json` and the precise set of
read-only fields rejected on create are the parts **not** crisply documented
publicly. The code handles the documented/expected shapes defensively, but on
your first live run:

- Use `--dry-run` against an ad you own and inspect the printed XML.
- If `create_ad` returns an error, the server's XML error message is surfaced
  verbatim — add any offending element's local-name to `READ_ONLY_LOCALNAMES`
  in `repost.py`.
- If the rebuilt `<pic:pictures>` block looks wrong, compare it against a real
  ad's `GET /ads/{id}` output and adjust `extract_uploaded_links` /
  `build_pictures_element` in `pictures.py`.
