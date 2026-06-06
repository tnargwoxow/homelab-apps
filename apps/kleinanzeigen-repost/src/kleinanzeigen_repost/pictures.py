"""Download a source ad's images and re-upload them as fresh pictures.

The user requires that images are physically re-hosted on each repost rather
than reusing the original ad's CDN URLs, so the repost flow is:

    source ad XML  -->  picture URLs  -->  download bytes
                   -->  POST /pictures.json  -->  new picture links
                   -->  rebuilt <pic:pictures> element for the new ad

The exact JSON shape returned by ``/pictures.json`` and the ``<pic:link>``
``rel`` values are not crisply documented publicly; the extractors below are
written defensively and the README explains how to confirm them against a real
ad.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

import requests

from .namespaces import qn

# Preferred image size, largest first. Kleinanzeigen serves several "rules"
# (sizes) per picture; we download the biggest available so the re-upload keeps
# full quality.
_RULE_PREFERENCE = ("XXL", "XL", "L", "ruleXXL", "ruleXL", "ruleL", "teaser")


def extract_picture_urls(ad_xml: str) -> list[str]:
    """Return one best (largest) download URL per picture in the ad XML."""
    root = ET.fromstring(ad_xml)
    urls: list[str] = []
    for picture in root.iter(qn("pic", "picture")):
        links = picture.findall(qn("pic", "link"))
        url = _pick_best_link(
            [(lk.get("rel", ""), lk.get("href", "")) for lk in links]
        )
        if url:
            urls.append(url)
    return urls


def _pick_best_link(links: list[tuple[str, str]]) -> str | None:
    """Choose the largest-resolution href from (rel, href) pairs."""
    by_rel = {rel: href for rel, href in links if href}
    if not by_rel:
        return None
    for rule in _RULE_PREFERENCE:
        if rule in by_rel:
            return by_rel[rule]
    # Fall back to the first link we were given.
    return next(iter(by_rel.values()))


def download(url: str, session: requests.Session | None = None) -> bytes:
    """Fetch the raw bytes of one image."""
    getter = session.get if session is not None else requests.get
    resp = getter(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def extract_uploaded_links(upload_json: dict) -> list[tuple[str, str]]:
    """Pull (rel, href) link pairs out of a /pictures.json upload response.

    Tolerant of the response being either a single picture object or a list
    wrapped under ``pictures`` -> ``picture``.
    """
    picture = upload_json.get("pictures", upload_json).get("picture", upload_json)
    if isinstance(picture, list):
        picture = picture[0] if picture else {}
    raw_links = picture.get("link", [])
    if isinstance(raw_links, dict):
        raw_links = [raw_links]
    pairs: list[tuple[str, str]] = []
    for link in raw_links:
        href = link.get("href") or link.get("@href")
        rel = link.get("rel") or link.get("@rel") or ""
        if href:
            pairs.append((rel, href))
    return pairs


def build_pictures_element(uploaded: list[list[tuple[str, str]]]) -> ET.Element:
    """Build a fresh <pic:pictures> element from re-uploaded picture links.

    ``uploaded`` is a list (one entry per picture) of (rel, href) link pairs.
    """
    pictures = ET.Element(qn("pic", "pictures"))
    for links in uploaded:
        if not links:
            continue
        picture = ET.SubElement(pictures, qn("pic", "picture"))
        for rel, href in links:
            link = ET.SubElement(picture, qn("pic", "link"))
            if rel:
                link.set("rel", rel)
            link.set("href", href)
    return pictures


def rehost_pictures(
    client, ad_xml: str, session: requests.Session | None = None
) -> ET.Element:
    """Download every image in ``ad_xml`` and re-upload it.

    Returns a ready-to-splice <pic:pictures> element referencing the new copies.
    """
    uploaded: list[list[tuple[str, str]]] = []
    for index, url in enumerate(extract_picture_urls(ad_xml)):
        data = download(url, session=session)
        resp = client.upload_picture(f"image_{index}.jpg", data)
        uploaded.append(extract_uploaded_links(resp))
    return build_pictures_element(uploaded)
