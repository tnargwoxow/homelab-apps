"""Turn an existing ad into a fresh duplicate listing."""

from __future__ import annotations

import copy
import html
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


# The exact element order the app posts on create. ECG validates against an
# ordered XSD sequence, so the wrong order is rejected with an opaque 500. Each
# entry is (prefix, local-name); the build pulls the value from the source ad,
# except the synthesised ones noted below.
CREATE_ORDER = (
    ("ad", "title"),
    ("ad", "description"),
    ("ad", "contact-name"),
    ("ad", "email"),            # synthesised from the account email
    ("ad", "poster-type"),
    ("ad", "ad-type"),
    ("cat", "category"),
    ("loc", "locations"),
    ("ad", "ad-address"),
    ("ad", "price"),
    ("medias", "medias"),       # synthesised empty
    ("pic", "pictures"),        # replaced with the re-uploaded block
    ("attr", "attributes"),
    ("shipping", "shipping-options"),  # synthesised empty
    ("payment", "buy-now"),     # synthesised, selected="false"
)


def sanitize_ad_xml(
    ad_xml: str, pictures: ET.Element | None = None, email: str | None = None
) -> str:
    """Build a create-ready ad XML from the source ad's GET representation.

    Emits only the fields the app sends on create, in the app's exact order,
    slimmed to the create schema (bare category/location/attribute identifiers).
    """
    source = ET.fromstring(ad_xml)
    _slim_for_create(source)
    by_tag = {child.tag: child for child in source}

    out = ET.Element(qn("ad", "ad"))
    out.set("id", "0")  # new ads post with id="0"
    if source.get("locale"):
        out.set("locale", source.get("locale"))

    for prefix, name in CREATE_ORDER:
        tag = qn(prefix, name)
        if name == "email":
            if email:
                ET.SubElement(out, tag).text = email
        elif name == "pictures":
            if pictures is not None:
                out.append(pictures)
            elif tag in by_tag:
                out.append(copy.deepcopy(by_tag[tag]))
        elif name in ("medias", "shipping-options"):
            ET.SubElement(out, tag)  # empty container
        elif name == "buy-now":
            ET.SubElement(out, tag, {"selected": "false"})
        elif tag in by_tag:
            out.append(copy.deepcopy(by_tag[tag]))

    # The GET representation HTML-encodes free text (e.g. "/" -> "&#x2F;"), which
    # inflates length and would post literally. Decode it back to plain text;
    # ElementTree re-applies the correct minimal XML escaping on serialize.
    for el in out:
        if local_name(el.tag) in ("title", "description", "contact-name") and el.text:
            el.text = html.unescape(el.text)

    return ET.tostring(out, encoding="unicode")


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
                # The app sends only name + value(s); drop type and all the
                # display-only attrs.
                for key in list(attribute.attrib):
                    if key != "name":
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
        return sanitize_ad_xml(source_xml, email=getattr(client, "email", None))

    new_pictures = pictures_mod.rehost_pictures(client, source_xml)
    new_xml = sanitize_ad_xml(
        source_xml, pictures=new_pictures, email=getattr(client, "email", None)
    )
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
