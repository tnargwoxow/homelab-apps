"""Turn an existing ad into a fresh duplicate listing."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from .namespaces import local_name, qn

# Direct children of <ad:ad> that the server manages and rejects (or ignores)
# on create. We strip these before re-posting. Extend this set if the API
# returns "unknown/forbidden element" errors for a fresh ad (see README).
READ_ONLY_LOCALNAMES = {
    "id",
    "start-date-time",
    "end-date-time",
    "displayed-until-date-time",
    "ad-status",
    "state",
    "link",
    "user-id",
    "account-id",
    "ad-source",
    "search-distance",
    "store-id",
    "store-title",
    "imprint",
    "features-active",
    "visible-on-map",
    "rank",
}

# Trailing numeric id in a kleinanzeigen.de listing URL, e.g.
# https://www.kleinanzeigen.de/s-anzeige/some-title/2961234567-217-1234
_URL_ID_RE = re.compile(r"/(\d{6,})(?:-\d+)*(?:[/?#]|$)")


def parse_ad_id(arg: str) -> str:
    """Accept a bare numeric id or a full listing URL, return the ad id."""
    arg = arg.strip()
    if arg.isdigit():
        return arg
    match = _URL_ID_RE.search(arg)
    if match:
        return match.group(1)
    raise ValueError(f"could not find an ad id in {arg!r}")


def sanitize_ad_xml(ad_xml: str, pictures: ET.Element | None = None) -> str:
    """Strip server-managed fields and optionally replace the pictures block.

    Returns a serialized XML string ready to POST to the create endpoint.
    """
    root = ET.fromstring(ad_xml)

    # Drop id/version attributes from the root ad element.
    for attr in ("id", "version"):
        root.attrib.pop(attr, None)

    # Remove read-only direct children.
    for child in list(root):
        if local_name(child.tag) in READ_ONLY_LOCALNAMES:
            root.remove(child)

    # Replace the pictures block with the freshly re-uploaded one.
    if pictures is not None:
        for child in list(root):
            if child.tag == qn("pic", "pictures"):
                root.remove(child)
        root.append(pictures)

    return ET.tostring(root, encoding="unicode")


def repost(client, ad_id: str, *, dry_run: bool = False) -> str | None:
    """Fetch ad ``ad_id``, rehost its images, and create a duplicate.

    Returns the new ad id (or the sanitized XML when ``dry_run`` is set).
    """
    # Imported here so unit tests for parsing/sanitizing don't require requests.
    from . import pictures as pictures_mod

    source_xml = client.get_ad_xml(ad_id)

    if dry_run:
        # Non-destructive: verify every image is downloadable but do NOT upload
        # anything or create an ad. The printed XML keeps the source pictures;
        # a real run re-uploads them and swaps in the new links.
        for url in pictures_mod.extract_picture_urls(source_xml):
            pictures_mod.download(url)
        return sanitize_ad_xml(source_xml)

    new_pictures = pictures_mod.rehost_pictures(client, source_xml)
    new_xml = sanitize_ad_xml(source_xml, pictures=new_pictures)
    resp = client.create_ad(new_xml)
    return _new_ad_id(resp)


def _new_ad_id(resp) -> str | None:
    """Extract the created ad id from the Location header or response body."""
    location = resp.headers.get("Location") or resp.headers.get("location")
    if location:
        match = re.search(r"/(\d+)(?:\.\w+)?$", location)
        if match:
            return match.group(1)
    try:
        root = ET.fromstring(resp.text)
        return root.attrib.get("id")
    except ET.ParseError:
        return None
