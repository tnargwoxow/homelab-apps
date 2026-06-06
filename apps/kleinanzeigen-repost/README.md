# kleinanzeigen-repost

A small Python CLI that takes one of **your own** existing
[Kleinanzeigen](https://www.kleinanzeigen.de) listings and re-publishes it as a
fresh duplicate ad — the classic "repost to jump back to the top of the search
results" workflow. It downloads the source ad's photos and re-uploads them, so
the new ad is a genuine fresh listing.

It talks to the same internal REST API the official Kleinanzeigen Android app
uses (`api.kleinanzeigen.de`).

> ⚠️ Automated reposting is against Kleinanzeigen's terms of service. This is a
> personal tool — one repost per invocation, no loops. Use sparingly.

## How auth works (the important part)

The modern Kleinanzeigen app authenticates with **Auth0 OAuth2** (white-labelled
at `login.kleinanzeigen.de`), and the interactive login is protected by **Akamai
Bot Manager** — so you cannot script the login itself (it detects non-genuine
clients and returns a misleading *"IP-Bereich vorübergehend gesperrt"* 403).

The way around it: the app requests the `offline_access` scope, so it gets a
**long-lived refresh token**. We capture that refresh token **once** (see
[Re-capturing the refresh token](#re-capturing-the-refresh-token)), and from then
on the tool mints short-lived access tokens itself:

```
POST https://login.kleinanzeigen.de/oauth/token
  {"client_id": "<app client id>", "refresh_token": "<yours>", "grant_type": "refresh_token"}
→ { access_token: <1h JWT>, ... }
```

That token endpoint is **not** bot-gated and works from plain Python. The refresh
token is **non-rotating**, so the same one keeps working indefinitely — until you
log out of the app or Auth0 enforces an absolute expiry.

The data API then accepts the access token via:

```
Authorization: Basic base64(android:TaR60pEttY)        # static partner credential
X-ECG-Authorization-User: email=<you>,access=<access-jwt>
```

### Repost flow

1. `POST /oauth/token` → fresh access token (user id + email decoded from the JWT).
2. `GET /api/users/<userId>/ads/<adId>` (Accept: application/xml) → the source ad XML.
3. **Download every photo and re-upload it** via `POST /api/pictures.json` (each
   returns a signed image URL).
4. Rebuild the ad XML in the exact create schema: only the fields the app sends,
   in the app's element order, with `id="0"`, free text HTML-decoded, attributes
   slimmed to `name`+`value`, and each picture a single signed `thumbnail` link.
5. `POST /api/users/<userId>/ads.json` with **`Content-Type: application/json`**
   (the body is XML — `application/xml` is rejected with an opaque 500) → new ad.

The create payload is fiddly because the GET representation differs from what
POST accepts. Pitfalls that each produced an error, now handled:
- `application/xml` content-type → opaque 500 (must be `application/json`).
- Wrong element order → opaque 500 (ECG validates an ordered XSD sequence).
- Enriched category/location/attributes from GET → rejected (slim to ids/values).
- HTML-encoded title/description from GET → length errors / literal `&#x2F;`
  (must be `html.unescape`d).

## Setup

```bash
cd apps/kleinanzeigen-repost
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env      # then set KA_REFRESH_TOKEN (see below)
```

`.env`:

| Variable           | Required | Meaning                                            |
|--------------------|----------|----------------------------------------------------|
| `KA_REFRESH_TOKEN` | yes      | long-lived Auth0 refresh token captured from the app |
| `KA_CLIENT_ID`     | no       | app's Auth0 client id (sensible default baked in)  |
| `KA_EMAIL`         | no       | fallback; normally auto-derived from the token     |
| `KA_USER_ID`       | no       | fallback; normally auto-derived from the token     |

## Usage

```bash
# Non-destructive: mint token, fetch ad, verify photos download, print the XML.
ka-repost 3420459890 --dry-run
ka-repost "https://www.kleinanzeigen.de/s-anzeige/.../3420459890-88-3405" --dry-run

# Real repost (downloads + re-uploads photos, creates a new ad):
ka-repost 3420459890

# Repost and remove the old listing:
ka-repost 3420459890 --delete-original
```

## Web UI / Docker

A small Flask app gives you a browser form: paste an ad URL/id, tick **Dry run**
and/or **Delete original**, hit Duplicate.

```bash
cp .env.example .env      # set KA_REFRESH_TOKEN
docker compose up -d --build
# open http://<host>:8090
```

Endpoints:
- `GET /` — the UI
- `GET /healthz` — health check
- `POST /api/repost` — JSON `{"ad": "<url|id>", "dry_run": false, "delete_original": false}`
  → `{ok, mode, ad_id, new_ad_id, ...}` (or `{ok:true, mode:"dry_run", xml}`)

Run it without Docker for local dev: `ka-repost-server` (serves on `PORT`, default 8090).

## Tests

```bash
python -m pytest      # offline: id/URL parsing, XML sanitizing, picture rebuild
```

## Re-capturing the refresh token

If the refresh token ever stops working (you logged out of the app, changed your
password, or Auth0 hit an absolute expiry — symptom: `token refresh failed` from
the tool), capture a new one. This needs an Android phone with USB debugging and
a Mac with `adb`, `node`/`npx`, and `mitmproxy` (`brew install mitmproxy`). The
catch is the app pins TLS, so we run a pinning-patched build once.

```bash
# 1. Pull the installed app (split APK) off the phone
adb shell pm path com.ebay.kleinanzeigen          # note the base/split apk paths
mkdir ka && cd ka
adb pull <base.apk> ; adb pull <split_config.*.apk>   # all parts

# 2. Patch out certificate pinning (also makes it trust user CAs), re-sign
zip -j app.apks base.apk split_config.*.apk
npx apk-mitm app.apks                              # -> app-patched.apks

# 3. Trust mitmproxy's CA on the phone
mitmdump &                                         # first run generates the CA, then Ctrl-C
adb push ~/.mitmproxy/mitmproxy-ca-cert.cer /sdcard/Download/mitmproxy-ca.crt
#   On phone: Settings -> Security -> Install from device storage -> CA certificate -> pick it

# 4. Install the patched app (clears app data -> you log in fresh)
adb uninstall com.ebay.kleinanzeigen
unzip app-patched.apks -d patched
adb install-multiple patched/base.apk patched/split_config.*.apk

# 5. Proxy the phone through mitmproxy over USB (works on cellular too)
adb reverse tcp:8080 tcp:8080
adb shell settings put global http_proxy 127.0.0.1:8080
mitmdump -s capture_oauth.py                       # see snippet below
```

Then, on the phone:

- **Log in with the proxy OFF first** if Akamai blocks the login page while
  proxied: `adb shell settings put global http_proxy :0`, complete login + MFA,
  then turn the proxy back on. (The re-signed app breaks Android App Links, so if
  the OAuth callback fails with "Anmeldung konnte nicht abgeschlossen werden",
  enable *Settings → Apps → Kleinanzeigen → Open by default → Open supported
  links* for `login.kleinanzeigen.de`.)
- To force the app to use its refresh token (so you can capture it), advance the
  phone clock ~2 h (*Settings → Date and time → off automatic*) and open the app —
  the Auth0 SDK will treat the access token as expired and call `/oauth/token`
  with the refresh token. Reset automatic time afterwards.

`capture_oauth.py` for mitmproxy:

```python
from mitmproxy import http
def request(flow: http.HTTPFlow):
    if flow.request.pretty_host == "login.kleinanzeigen.de" and "/oauth/token" in flow.request.path:
        print("OAUTH BODY:", flow.request.get_text())   # contains refresh_token
```

Put the captured `refresh_token` value into `.env` as `KA_REFRESH_TOKEN`. Clean
up: `adb shell settings put global http_proxy :0`, `adb reverse --remove-all`,
and you can reinstall the normal app (uninstalling the patched app does **not**
revoke the refresh token — only logging out does).

## Status

End-to-end verified: fetch → re-upload all photos → create. A reposted ad goes
live (ACTIVE) with all its pictures. If Kleinanzeigen tweaks the create schema
later, the tool surfaces the server's field error verbatim (e.g.
`title: max length 65`) so it's clear what to adjust in `CREATE_ORDER` /
`sanitize_ad_xml` in `repost.py`.
