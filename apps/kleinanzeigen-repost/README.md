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

## "IP-Bereich vorübergehend gesperrt" (403)

This anti-fraud message is **not** about your credentials. Two distinct things
can trigger it, both found during testing:

1. **Outdated app version.** The old `X-ECG-USER-AGENT: ebayk-android-app-13.4.2`
   identifier is blocked outright. The default is now a current-ish version
   (`ebayk-android-app-100.9.0`); bump `KA_APP_TYPE` / `KA_APP_VERSION` if it
   ages out again.
2. **IP-range rate block.** Shared mobile/CGNAT and VPN/datacenter IPs, or just
   too many requests in a short window, get the whole IP range temporarily
   banned across all endpoints. The official app keeps working because it reuses
   a cached session and doesn't hammer the API. Fix: wait ~15-60 min and retry
   from a residential connection, **or** use `KA_TOKEN` to skip the login call
   (the `/users/login` endpoint is the most heavily gated).

## Getting a token from your phone (no root)

`/users/login` is the most aggressively anti-fraud-gated endpoint. If you can
grab the session token the app already holds, set `KA_TOKEN` and the tool skips
login entirely. On a non-rooted Android phone, easiest first:

- **Try `adb backup`** (works only if the app allows backup):
  ```bash
  adb backup -f ka.ab -noapk com.ebay.kleinanzeigen   # confirm on the phone
  # if the .ab is non-empty, unpack it and look in shared_prefs for the token:
  ( printf 'FF\x0a' ; tail -c +25 ka.ab | python3 -c "import sys,zlib;sys.stdout.buffer.write(zlib.decompress(sys.stdin.buffer.read()))" ) > ka.tar
  tar xf ka.tar && grep -rEi 'token|ecg' apps/com.ebay.kleinanzeigen/sp/ 2>/dev/null
  ```
  Most modern apps set `allowBackup=false`, so this often produces an empty
  archive — if so, use the proxy method.
- **Proxy with a pinning-patched APK** (reliable, still no root): download the
  Kleinanzeigen APK, run it through [`apk-mitm`](https://github.com/shroudedcode/apk-mitm)
  to disable certificate pinning, install the patched APK, point the phone's
  Wi-Fi proxy at [mitmproxy](https://mitmproxy.org) on your computer (install its
  CA on the phone), open the app, and read the `X-EBAYK-TOKEN` response header /
  `X-ECG-Authorization-User: …token="…"` request header from the login or any
  authenticated call.

Then put the value in `.env` as `KA_TOKEN=...` (you can drop `KA_PASSWORD`).
