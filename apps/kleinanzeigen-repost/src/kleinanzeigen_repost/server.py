"""Tiny web service: a form + JSON API around the repost tool.

    GET  /            -> the UI
    GET  /healthz     -> health check
    POST /api/repost  -> {ad, dry_run, delete_original} -> result JSON

Credentials come from the environment (KA_REFRESH_TOKEN, optionally KA_EMAIL /
KA_USER_ID), same as the CLI.
"""

from __future__ import annotations

import os

from flask import Flask, Response, jsonify, request

from .cli import _load_dotenv
from .client import KleinanzeigenClient, KleinanzeigenError
from .repost import parse_ad_id, repost

MY_ADS_URL = "https://www.kleinanzeigen.de/m-meine-anzeigen.html"


def _make_client() -> KleinanzeigenClient:
    refresh_token = os.environ.get("KA_REFRESH_TOKEN")
    if not refresh_token:
        raise RuntimeError("KA_REFRESH_TOKEN is not set")
    return KleinanzeigenClient(
        refresh_token,
        email=os.environ.get("KA_EMAIL"),
        user_id=os.environ.get("KA_USER_ID"),
    )


def create_app() -> Flask:
    _load_dotenv()  # local convenience; in Docker, env comes from env_file
    app = Flask(__name__)

    @app.get("/")
    def index() -> Response:
        return Response(INDEX_HTML, mimetype="text/html")

    @app.get("/healthz")
    def healthz():
        return jsonify(ok=True)

    @app.post("/api/repost")
    def api_repost():
        data = request.get_json(force=True, silent=True) or {}
        ad = str(data.get("ad", "")).strip()
        dry_run = bool(data.get("dry_run"))
        delete_original = bool(data.get("delete_original"))

        if not ad:
            return jsonify(ok=False, error="Please enter an ad URL or id."), 400
        try:
            ad_id = parse_ad_id(ad)
        except ValueError as exc:
            return jsonify(ok=False, error=str(exc)), 400

        try:
            client = _make_client()
            result = repost(client, ad_id, dry_run=dry_run)
        except KleinanzeigenError as exc:
            return jsonify(ok=False, error=f"API error: {exc}"), 502
        except Exception as exc:  # noqa: BLE001 - surface config errors to the UI
            return jsonify(ok=False, error=str(exc)), 500

        if dry_run:
            return jsonify(ok=True, mode="dry_run", ad_id=ad_id, xml=result)

        new_ad_id = result
        deleted_original = False
        if delete_original and new_ad_id:
            try:
                client.delete_ad(ad_id)
                deleted_original = True
            except KleinanzeigenError as exc:
                return jsonify(
                    ok=True, mode="created", ad_id=ad_id, new_ad_id=new_ad_id,
                    deleted_original=False,
                    warning=f"Created, but deleting the original failed: {exc}",
                    my_ads_url=MY_ADS_URL,
                )
        return jsonify(
            ok=True, mode="created", ad_id=ad_id, new_ad_id=new_ad_id,
            deleted_original=deleted_original, my_ads_url=MY_ADS_URL,
        )

    return app


INDEX_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kleinanzeigen Repost</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    margin: 0; background: #0f172a; color: #e2e8f0; display: flex;
    min-height: 100vh; align-items: center; justify-content: center; padding: 1rem; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px;
    padding: 1.5rem; width: 100%; max-width: 560px; box-shadow: 0 10px 40px rgba(0,0,0,.4); }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  p.sub { margin: 0 0 1.25rem; color: #94a3b8; font-size: .9rem; }
  label { display: block; font-size: .85rem; color: #cbd5e1; margin: 0 0 .35rem; }
  input[type=text] { width: 100%; padding: .7rem .8rem; border-radius: 10px;
    border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font-size: 1rem; }
  .checks { display: flex; gap: 1.25rem; margin: 1rem 0; flex-wrap: wrap; }
  .checks label { display: flex; align-items: center; gap: .5rem; margin: 0; cursor: pointer;
    font-size: .95rem; color: #e2e8f0; }
  .checks input { width: 1.1rem; height: 1.1rem; }
  button { width: 100%; padding: .8rem; border: 0; border-radius: 10px; cursor: pointer;
    background: #38bdf8; color: #042f3e; font-weight: 600; font-size: 1rem; }
  button:disabled { opacity: .6; cursor: progress; }
  .danger { color: #fca5a5; font-size: .8rem; margin: .4rem 0 0; min-height: 1rem; }
  #result { margin-top: 1.25rem; }
  .box { border-radius: 10px; padding: .9rem 1rem; font-size: .9rem; }
  .ok { background: #052e1b; border: 1px solid #166534; color: #bbf7d0; }
  .err { background: #2e0a0a; border: 1px solid #7f1d1d; color: #fecaca; }
  a { color: #7dd3fc; }
  pre { white-space: pre-wrap; word-break: break-all; max-height: 320px; overflow: auto;
    background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: .75rem;
    font-size: .72rem; color: #cbd5e1; margin: .6rem 0 0; }
  details summary { cursor: pointer; color: #94a3b8; font-size: .8rem; margin-top: .5rem; }
</style>
</head>
<body>
  <div class="card">
    <h1>Kleinanzeigen Repost</h1>
    <p class="sub">Paste one of your ad URLs (or its id) and duplicate it.</p>
    <label for="ad">Ad URL or id</label>
    <input id="ad" type="text" placeholder="https://www.kleinanzeigen.de/s-anzeige/.../3420459890-88-3405"
      autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="checks">
      <label><input type="checkbox" id="dry"> Dry run (no changes)</label>
      <label><input type="checkbox" id="del"> Delete original</label>
    </div>
    <button id="go">Duplicate</button>
    <p class="danger" id="delwarn"></p>
    <div id="result"></div>
  </div>
<script>
const $ = (id) => document.getElementById(id);
const del = $('del'), dry = $('dry'), warn = $('delwarn');
function syncWarn() {
  warn.textContent = (del.checked && !dry.checked)
    ? '⚠ The original ad will be permanently deleted after the copy is created.' : '';
}
del.addEventListener('change', syncWarn);
dry.addEventListener('change', syncWarn);

$('go').addEventListener('click', async () => {
  const ad = $('ad').value.trim();
  const result = $('result');
  result.innerHTML = '';
  if (!ad) { result.innerHTML = '<div class="box err">Enter an ad URL or id.</div>'; return; }
  $('go').disabled = true; $('go').textContent = dry.checked ? 'Checking…' : 'Duplicating…';
  try {
    const r = await fetch('/api/repost', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ ad, dry_run: dry.checked, delete_original: del.checked })
    });
    const d = await r.json();
    if (!d.ok) {
      result.innerHTML = '<div class="box err">' + escapeHtml(d.error || 'Failed') + '</div>';
    } else if (d.mode === 'dry_run') {
      result.innerHTML = '<div class="box ok">Dry run OK — this is the ad that <b>would</b> be posted '
        + '(nothing was created or uploaded).</div>'
        + '<details><summary>Show generated ad XML</summary><pre>' + escapeHtml(d.xml) + '</pre></details>';
    } else {
      let msg = '<div class="box ok">✅ Reposted! New ad id <b>' + escapeHtml(d.new_ad_id || '?') + '</b>.';
      if (d.deleted_original) msg += ' Original deleted.';
      if (d.warning) msg += '<br><span style="color:#fca5a5">' + escapeHtml(d.warning) + '</span>';
      msg += '<br><a href="' + d.my_ads_url + '" target="_blank" rel="noopener">Open “Meine Anzeigen”</a></div>';
      result.innerHTML = msg;
    }
  } catch (e) {
    result.innerHTML = '<div class="box err">' + escapeHtml(String(e)) + '</div>';
  } finally {
    $('go').disabled = false; $('go').textContent = 'Duplicate';
  }
});
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
</script>
</body>
</html>"""


app = create_app()


def main() -> None:
    """Run the dev server (production uses gunicorn — see Dockerfile)."""
    port = int(os.environ.get("PORT", "8090"))
    app.run(host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
