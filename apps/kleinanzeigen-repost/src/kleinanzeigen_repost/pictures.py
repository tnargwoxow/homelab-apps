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


def new_base_url(upload_json: dict) -> str:
    """Extract the new image's base URL (no query) from a /pictures.json reply.

    The response is a JAXB envelope: {"{ns}picture": {"value": {"link": [...]}}}.
    Every link shares the same base URL (the new image UUID); we take the first.
    """
    picture = next(iter(upload_json.values()))
    value = picture.get("value", picture) if isinstance(picture, dict) else {}
    for link in value.get("link", []):
        href = link.get("href")
        if href:
            return href.split("?", 1)[0]
    raise ValueError(f"no picture link in upload response: {upload_json!r}")


def rehost_pictures(
    client, ad_xml: str, session: requests.Session | None = None
) -> ET.Element:
    """Download every image in ``ad_xml``, re-upload it, and return a fresh
    <pic:pictures> element referencing the new copies."""
    new_pictures = ET.Element(qn("pic", "pictures"))
    source = _pictures_element(ad_xml)
    if source is None:
        return new_pictures

    for index, picture in enumerate(source.findall(qn("pic", "picture"))):
        links = picture.findall(qn("pic", "link"))
        download_url = _best_download_url(_links(picture))
        if not download_url:
            continue
        data = download(download_url, session=session)
        resp = client.upload_picture(f"image_{index}.jpg", data)
        base = new_base_url(resp)

        # Clone the source picture, swapping each link's image base URL.
        new_picture = ET.SubElement(new_pictures, qn("pic", "picture"))
        for link in links:
            href = link.get("href")
            if not href:
                continue
            suffix = href.split("?", 1)[1] if "?" in href else ""
            new_link = ET.SubElement(new_picture, qn("pic", "link"))
            rel = link.get("rel")
            if rel:
                new_link.set("rel", rel)
            new_link.set("href", base + ("?" + suffix if suffix else ""))
    return new_pictures
