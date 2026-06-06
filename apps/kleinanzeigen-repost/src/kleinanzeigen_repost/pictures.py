"""Download a source ad's images and re-upload them as fresh pictures.

The user requires that images are physically re-hosted on each repost rather
than reusing the original ad's CDN URLs, so the repost flow is:

    source ad XML  -->  per <pic:picture>: pick largest link, download bytes
                   -->  POST /api/pictures.json  -->  new image (new UUID)
                   -->  clone the source <pic:picture>, swapping the image base
                        URL to the freshly-uploaded one

Cloning the source picture element (rather than rebuilding it) keeps the exact
``rel`` / ``rule`` link structure the server itself produces, so the create
payload looks identical to a real stored ad — only the image identity changes.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

import requests

from .namespaces import qn

# Preferred source link to download, by ``rel``, largest first. ``canonicalUrl``
# is skipped (it's a "$_{imageId}" template, not a real image).
_REL_PREFERENCE = ("extraLarge", "XXL", "large", "teaser", "thumbnail")


def _pictures_element(ad_xml: str) -> ET.Element | None:
    root = ET.fromstring(ad_xml)
    for child in root:
        if child.tag == qn("pic", "pictures"):
            return child
    return None


def _links(picture: ET.Element) -> list[tuple[str, str]]:
    """Return (rel, href) pairs for a <pic:picture>, skipping template URLs."""
    out = []
    for link in picture.findall(qn("pic", "link")):
        href = link.get("href", "")
        if href and "{" not in href:  # skip canonicalUrl template
            out.append((link.get("rel", ""), href))
    return out


def _best_download_url(links: list[tuple[str, str]]) -> str | None:
    by_rel = {rel: href for rel, href in links}
    for rel in _REL_PREFERENCE:
        if rel in by_rel:
            return by_rel[rel]
    return next((href for _, href in links), None)


def extract_picture_urls(ad_xml: str) -> list[str]:
    """Return one best (largest) download URL per picture in the ad XML."""
    pictures = _pictures_element(ad_xml)
    if pictures is None:
        return []
    urls = []
    for picture in pictures.findall(qn("pic", "picture")):
        url = _best_download_url(_links(picture))
        if url:
            urls.append(url)
    return urls


def download(url: str, session: requests.Session | None = None) -> bytes:
    """Fetch the raw bytes of one image."""
    getter = session.get if session is not None else requests.get
    resp = getter(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def uploaded_link(upload_json: dict, rel: str = "thumbnail") -> str:
    """Return one (signed) link href from a /pictures.json upload reply.

    The response is a JAXB envelope: {"{ns}picture": {"value": {"link": [...]}}}.
    The create payload references a freshly-uploaded picture by the *signed*
    upload URL (the app uses the ``thumbnail`` rel), so we return that href.
    """
    picture = next(iter(upload_json.values()))
    value = picture.get("value", picture) if isinstance(picture, dict) else {}
    links = value.get("link", [])
    by_rel = {lk.get("rel"): lk.get("href") for lk in links if lk.get("href")}
    href = by_rel.get(rel) or next(iter(by_rel.values()), None)
    if not href:
        raise ValueError(f"no picture link in upload response: {upload_json!r}")
    return href


def rehost_pictures(
    client, ad_xml: str, session: requests.Session | None = None
) -> ET.Element:
    """Download every image in ``ad_xml``, re-upload it, and return a fresh
    <pic:pictures> element referencing the new copies.

    Each new picture is a single ``<pic:link rel="thumbnail" href="...">`` whose
    href is the signed upload URL — mirroring exactly what the app sends on
    create.
    """
    new_pictures = ET.Element(qn("pic", "pictures"))
    source = _pictures_element(ad_xml)
    if source is None:
        return new_pictures

    for index, picture in enumerate(source.findall(qn("pic", "picture"))):
        download_url = _best_download_url(_links(picture))
        if not download_url:
            continue
        data = download(download_url, session=session)
        resp = client.upload_picture(f"image_{index}.jpg", data)
        new_picture = ET.SubElement(new_pictures, qn("pic", "picture"))
        link = ET.SubElement(new_picture, qn("pic", "link"))
        link.set("rel", "thumbnail")
        link.set("href", uploaded_link(resp))
    return new_pictures
