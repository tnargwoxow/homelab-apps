"""Tiny web service: a form + JSON API around the repost tool.

    GET  /            -> the UI
    GET  /healthz     -> health check
    POST /api/load    -> {ad} -> the ad's editable fields
    POST /api/repost  -> {ad, edits, dry_run, delete_original} -> result JSON

Credentials come from the environment (KA_REFRESH_TOKEN, optionally KA_EMAIL /
KA_USER_ID), same as the CLI.
"""

from __future__ import annotations

import os

from flask import Flask, Response, jsonify, request

from .cli import _load_dotenv
from .client import KleinanzeigenClient, KleinanzeigenError
from .fields import category_id, extract_fields
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

    @app.post("/api/load")
    def api_load():
        """Fetch an ad and return its editable fields (read-only; no changes)."""
        data = request.get_json(force=True, silent=True) or {}
        ad = str(data.get("ad", "")).strip()
        if not ad:
            return jsonify(ok=False, error="Please enter an ad URL or id."), 400
        try:
            ad_id = parse_ad_id(ad)
        except ValueError as exc:
            return jsonify(ok=False, error=str(exc)), 400
        try:
            client = _make_client()
            source_xml = client.get_ad_xml(ad_id)
            metadata = None
            cat = category_id(source_xml)
            if cat:
                try:
                    metadata = client.get_category_metadata(cat)
                except KleinanzeigenError:
                    metadata = None  # dropdowns degrade to plain inputs
            fields = extract_fields(source_xml, metadata)
        except KleinanzeigenError as exc:
            return jsonify(ok=False, error=f"API error: {exc}"), 502
        except Exception as exc:  # noqa: BLE001
            return jsonify(ok=False, error=str(exc)), 500
        return jsonify(ok=True, ad_id=ad_id, fields=fields)

    @app.post("/api/repost")
    def api_repost():
        data = request.get_json(force=True, silent=True) or {}
        ad = str(data.get("ad", "")).strip()
        dry_run = bool(data.get("dry_run"))
        delete_original = bool(data.get("delete_original"))
        edits = data.get("edits") if isinstance(data.get("edits"), dict) else None

        if not ad:
            return jsonify(ok=False, error="Please enter an ad URL or id."), 400
        try:
            ad_id = parse_ad_id(ad)
        except ValueError as exc:
            return jsonify(ok=False, error=str(exc)), 400

        try:
            client = _make_client()
            result = repost(client, ad_id, dry_run=dry_run, edits=edits)
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


INDEX_HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kleinanzeigen Repost</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    margin: 0; background: #0f172a; color: #e2e8f0; display: flex;
    min-height: 100vh; align-items: flex-start; justify-content: center; padding: 1.5rem 1rem; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px;
    padding: 1.5rem; width: 100%; max-width: 620px; box-shadow: 0 10px 40px rgba(0,0,0,.4); }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  h2 { font-size: .95rem; margin: 1.4rem 0 .6rem; color: #cbd5e1;
    border-top: 1px solid #334155; padding-top: 1rem; }
  p.sub { margin: 0 0 1.25rem; color: #94a3b8; font-size: .9rem; }
  label { display: block; font-size: .8rem; color: #cbd5e1; margin: .8rem 0 .3rem; }
  input[type=text], textarea, select { width: 100%; padding: .6rem .7rem; border-radius: 9px;
    border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font-size: .95rem; font-family: inherit; }
  textarea { resize: vertical; }
  .row { display: flex; gap: .5rem; }
  .row input { flex: 1; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
  .hint { font-size: .72rem; color: #94a3b8; margin-top: .25rem; }
  .ro { font-size: .8rem; color: #94a3b8; margin-top: .8rem; }
  .checks { display: flex; gap: 1.25rem; margin: 1.2rem 0 .3rem; flex-wrap: wrap; }
  .checks label { display: flex; align-items: center; gap: .5rem; margin: 0; cursor: pointer;
    font-size: .95rem; color: #e2e8f0; }
  .checks input { width: 1.1rem; height: 1.1rem; }
  button { padding: .7rem 1rem; border: 0; border-radius: 9px; cursor: pointer;
    background: #38bdf8; color: #042f3e; font-weight: 600; font-size: .95rem; }
  button.secondary { background: #334155; color: #e2e8f0; }
  button:disabled { opacity: .6; cursor: progress; }
  #go { width: 100%; margin-top: .5rem; padding: .8rem; }
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
  .attr { margin-bottom: .6rem; }
  .photos { display: flex; flex-wrap: wrap; gap: .6rem; }
  .photo { position: relative; width: 92px; }
  .photo img { width: 92px; height: 92px; object-fit: cover; border-radius: 8px;
    border: 1px solid #475569; display: block; }
  .photo.removed img { opacity: .25; filter: grayscale(1); }
  .photo .ctrls { display: flex; justify-content: space-between; margin-top: .2rem; gap: .2rem; }
  .photo .ctrls button { padding: .15rem .4rem; font-size: .75rem; background: #334155; color: #e2e8f0; }
  .photo .x { position: absolute; top: 3px; right: 3px; background: rgba(15,23,42,.85);
    border: 1px solid #475569; color: #fca5a5; border-radius: 6px; padding: .05rem .35rem;
    font-size: .8rem; cursor: pointer; }
</style>
</head>
<body>
  <div class="card">
    <h1>Kleinanzeigen Repost</h1>
    <p class="sub">Paste one of your ad URLs (or its id), load it, edit, and duplicate.</p>
    <label for="ad">Ad URL or id</label>
    <div class="row">
      <input id="ad" type="text" placeholder="https://www.kleinanzeigen.de/s-anzeige/.../3420459890-88-3405"
        autocomplete="off" autocapitalize="off" spellcheck="false">
      <button id="load">Load</button>
    </div>
    <p class="danger" id="loaderr"></p>

    <div id="editor" hidden>
      <label for="f_title">Title</label>
      <input id="f_title" type="text" maxlength="65">
      <div class="hint" id="titlecount"></div>

      <label for="f_desc">Description</label>
      <textarea id="f_desc" rows="7"></textarea>

      <div class="grid2">
        <div><label for="f_amount">Price (€)</label><input id="f_amount" type="text"></div>
        <div><label for="f_ptype">Price type</label><select id="f_ptype"></select></div>
      </div>
      <div class="grid2">
        <div><label for="f_contact">Contact name</label><input id="f_contact" type="text"></div>
        <div><label for="f_zip">ZIP</label><input id="f_zip" type="text"></div>
      </div>
      <div class="ro" id="f_meta"></div>

      <h2>Attributes</h2>
      <div id="f_attrs"></div>

      <h2>Photos <span id="photocount" class="hint"></span></h2>
      <div id="f_photos" class="photos"></div>

      <div class="checks">
        <label><input type="checkbox" id="dry"> Dry run (no changes)</label>
        <label><input type="checkbox" id="del"> Delete original</label>
      </div>
      <p class="danger" id="delwarn"></p>
      <button id="go">Duplicate</button>
    </div>

    <div id="result"></div>
  </div>
<script>
const $ = (id) => document.getElementById(id);
let state = { fields: null, photos: [] };

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

$('load').addEventListener('click', loadAd);
$('ad').addEventListener('keydown', e => { if (e.key === 'Enter') loadAd(); });
$('f_title').addEventListener('input', updateTitleCount);
$('del').addEventListener('change', syncWarn);
$('dry').addEventListener('change', syncWarn);
$('go').addEventListener('click', duplicate);

function updateTitleCount(){
  const n = $('f_title').value.length;
  $('titlecount').textContent = n + '/65 characters';
  $('titlecount').style.color = n > 65 ? '#fca5a5' : '#94a3b8';
}
function syncWarn(){
  $('delwarn').textContent = ($('del').checked && !$('dry').checked)
    ? '⚠ The original ad will be permanently deleted after the copy is created.' : '';
}

async function loadAd(){
  const ad = $('ad').value.trim();
  $('loaderr').textContent = ''; $('result').innerHTML = '';
  if (!ad){ $('loaderr').textContent = 'Enter an ad URL or id.'; return; }
  $('load').disabled = true; $('load').textContent = 'Loading…';
  try {
    const r = await fetch('/api/load', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ad }) });
    const d = await r.json();
    if (!d.ok){ $('loaderr').textContent = d.error || 'Failed to load.'; $('editor').hidden = true; return; }
    state.fields = d.fields;
    renderEditor(d.fields);
    $('editor').hidden = false;
  } catch(e){ $('loaderr').textContent = String(e); }
  finally { $('load').disabled = false; $('load').textContent = 'Load'; }
}

function renderEditor(f){
  $('f_title').value = f.title || '';
  $('f_desc').value = f.description || '';
  $('f_amount').value = (f.price && f.price.amount) || '';
  $('f_contact').value = f.contact_name || '';
  $('f_zip').value = f.zip_code || '';
  updateTitleCount();

  // price type dropdown
  const sel = $('f_ptype'); sel.innerHTML = '';
  let opts = (f.price && f.price.type_options) || [];
  if (!opts.length && f.price && f.price.type) opts = [{value:f.price.type, label:f.price.type}];
  for (const o of opts){
    const opt = document.createElement('option');
    opt.value = o.value; opt.textContent = o.label;
    if (o.value === (f.price && f.price.type)) opt.selected = true;
    sel.appendChild(opt);
  }

  $('f_meta').innerHTML = 'Category: <b>' + escapeHtml((f.category&&f.category.label)||'?') +
    '</b> &nbsp;·&nbsp; Location: <b>' + escapeHtml((f.location&&f.location.label)||'?') + '</b>';

  // attributes
  const ac = $('f_attrs'); ac.innerHTML = '';
  for (const a of (f.attributes||[])){
    const wrap = document.createElement('div'); wrap.className = 'attr';
    const lab = document.createElement('label'); lab.textContent = a.label || a.name; wrap.appendChild(lab);
    let ctrl;
    if (a.options && a.options.length){
      ctrl = document.createElement('select');
      const vals = new Set();
      for (const o of a.options){
        const opt = document.createElement('option'); opt.value=o.value; opt.textContent=o.label;
        if (o.value === a.value) opt.selected = true; ctrl.appendChild(opt); vals.add(o.value);
      }
      if (a.value && !vals.has(a.value)){
        const opt = document.createElement('option'); opt.value=a.value; opt.textContent=a.value+' (current)';
        opt.selected = true; ctrl.appendChild(opt);
      }
    } else {
      ctrl = document.createElement('input'); ctrl.type='text'; ctrl.value = a.value || '';
    }
    ctrl.dataset.attr = a.name; wrap.appendChild(ctrl); ac.appendChild(wrap);
  }
  if (!(f.attributes||[]).length) ac.innerHTML = '<div class="hint">No editable attributes for this category.</div>';

  // photos
  state.photos = (f.pictures||[]).map(p => ({ index:p.index, thumb:p.thumb, removed:false }));
  renderPhotos();
}

function renderPhotos(){
  const c = $('f_photos'); c.innerHTML = '';
  state.photos.forEach((p, i) => {
    const el = document.createElement('div'); el.className = 'photo' + (p.removed ? ' removed' : '');
    el.innerHTML =
      '<div class="x" title="' + (p.removed?'Restore':'Remove') + '">' + (p.removed?'↺':'×') + '</div>' +
      '<img src="' + escapeHtml(p.thumb) + '" alt="">' +
      '<div class="ctrls"><button data-mv="-1">←</button><button data-mv="1">→</button></div>';
    el.querySelector('.x').onclick = () => { p.removed = !p.removed; renderPhotos(); };
    el.querySelectorAll('button').forEach(b => b.onclick = () => move(i, parseInt(b.dataset.mv)));
    c.appendChild(el);
  });
  const kept = state.photos.filter(p => !p.removed).length;
  $('photocount').textContent = kept + ' of ' + state.photos.length + ' kept';
}
function move(i, d){
  const j = i + d; if (j < 0 || j >= state.photos.length) return;
  const t = state.photos[i]; state.photos[i] = state.photos[j]; state.photos[j] = t; renderPhotos();
}

function collectEdits(){
  const attrs = {};
  $('f_attrs').querySelectorAll('[data-attr]').forEach(el => { attrs[el.dataset.attr] = el.value; });
  return {
    title: $('f_title').value,
    description: $('f_desc').value,
    price_amount: $('f_amount').value,
    price_type: $('f_ptype').value,
    contact_name: $('f_contact').value,
    zip_code: $('f_zip').value,
    attributes: attrs,
    pictures: state.photos.filter(p => !p.removed).map(p => p.index),
  };
}

async function duplicate(){
  const ad = $('ad').value.trim();
  const result = $('result'); result.innerHTML = '';
  const dry = $('dry').checked;
  if (state.photos.length && !state.photos.some(p => !p.removed)){
    result.innerHTML = '<div class="box err">Keep at least one photo.</div>'; return;
  }
  $('go').disabled = true; $('go').textContent = dry ? 'Checking…' : 'Duplicating…';
  try {
    const r = await fetch('/api/repost', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ad, edits: collectEdits(), dry_run: dry, delete_original: $('del').checked }) });
    const d = await r.json();
    if (!d.ok){
      result.innerHTML = '<div class="box err">' + escapeHtml(d.error || 'Failed') + '</div>';
    } else if (d.mode === 'dry_run'){
      result.innerHTML = '<div class="box ok">Dry run OK — this is the ad that <b>would</b> be posted '
        + '(nothing created or uploaded).</div>'
        + '<details><summary>Show generated ad XML</summary><pre>' + escapeHtml(d.xml) + '</pre></details>';
    } else {
      let msg = '<div class="box ok">✅ Reposted! New ad id <b>' + escapeHtml(d.new_ad_id || '?') + '</b>.';
      if (d.deleted_original) msg += ' Original deleted.';
      if (d.warning) msg += '<br><span style="color:#fca5a5">' + escapeHtml(d.warning) + '</span>';
      msg += '<br><a href="' + d.my_ads_url + '" target="_blank" rel="noopener">Open “Meine Anzeigen”</a></div>';
      result.innerHTML = msg;
    }
  } catch(e){ result.innerHTML = '<div class="box err">' + escapeHtml(String(e)) + '</div>'; }
  finally { $('go').disabled = false; $('go').textContent = 'Duplicate'; }
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
