"""Turn an existing ad into a fresh duplicate listing."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from .namespaces import local_name, qn

# Direct children of <ad:ad> that the server manages and rejects (or ignores)
# on create. We strip these before re-posting. Extend this set if the API
# returns "unknown/forbidden element" errors for a fresh ad (see README).
READ_ONLY_LOCALNAMES = {
    # timestamps / status the server owns
    "start-date-time",
    "end-date-time",
    "displayed-until-date-time",
    "user-since-date-time",
    "last-user-edit-date",
    "ad-status",
    "state",
    # identity / account fields derived from the authenticated user
    "link",
    "user-id",
    "account-id",
    "store-id",
    "store-title",
    "seller-account-type",
    "contact-name-initials",
    "userBadges",
    "ad-source",
    "ad-source-id",
    "ad-external-reference-id",
    "originId",
    # server-computed display / tracking / misc
    "placeholder-image-present",
    "features-active",
    "displayoptions",
    "tracking",
    "medias",
    "documents",
    "buy-now",
    "financing-provider",
    "financing-details",
    "financing-eligible",
    "re-financing-eligible",
    "search-distance",
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

    _slim_for_create(root)

    # Replace the pictures block with the freshly re-uploaded one.
    if pictures is not None:
        for child in list(root):
            if child.tag == qn("pic", "pictures"):
                root.remove(child)
        root.append(pictures)

    return ET.tostring(root, encoding="unicode")


def _slim_for_create(root: ET.Element) -> None:
    """Reduce the read (GET) representation to what create (POST) accepts.

    The GET payload enriches category/location/attributes with display-only
    children (localized names, regions, labels) that the create parser chokes on.
    Strip those down to the bare identifiers + values.
    """
    for child in root:
        name = local_name(child.tag)
        if name == "category":
            # Keep only the id attribute; drop id-name/localized-name/etc.
            for sub in list(child):
                child.remove(sub)
        elif name == "locations":
            for location in child.findall(qn("loc", "location")):
                for sub in list(location):
                    location.remove(sub)
        elif name == "attributes":
            for attribute in child.findall(qn("attr", "attribute")):
                # Keep name + type + the value(s); drop display-only attrs.
                for key in list(attribute.attrib):
                    if key not in ("name", "type"):
                        del attribute.attrib[key]
                for value in attribute.findall(qn("attr", "range-value")):
                    if not (value.text and value.text.strip()):
                        attribute.remove(value)
                for value in attribute.findall(qn("attr", "value")):
                    value.attrib.pop("localized-label", None)


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
