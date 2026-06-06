"""Parse an ad's XML into a friendly, editable field structure, and apply edits.

``extract_fields`` turns the GET ad XML (+ optional category metadata) into a
labelled dict the UI renders as a form. ``apply_edits`` writes the user's changes
back onto the built create XML.
"""

from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET

from .namespaces import qn

_BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)


def _text(parent: ET.Element | None, *path: str) -> str:
    """Follow a chain of qualified child tags and return the leaf text."""
    node = parent
    for prefix_local in path:
        if node is None:
            return ""
        prefix, local = prefix_local.split(":")
        node = node.find(qn(prefix, local))
    return (node.text or "").strip() if node is not None else ""


def description_to_text(raw: str | None) -> str:
    """Stored description -> clean multi-line text for a textarea."""
    if not raw:
        return ""
    return _BR_RE.sub("\n", html.unescape(raw))


def text_to_description(text: str) -> str:
    """Textarea text -> stored description form (newlines as <br/>)."""
    return text.replace("\r\n", "\n").replace("\n", "<br/>")


def _supported_values(node: dict) -> list[dict]:
    raw = node.get("supported-value", []) if isinstance(node, dict) else []
    out = []
    for v in raw:
        value = v.get("value")
        if value is not None:
            out.append({"value": value, "label": v.get("localized-label") or value})
    return out


def _metadata_attributes(metadata: dict | None) -> dict:
    """Map attribute-name -> {label, options} from category metadata JSON."""
    if not metadata:
        return {}
    try:
        ad = next(iter(metadata.values()))["value"]
        attrs = ad["attributes"]["attribute"]
    except (StopIteration, KeyError, TypeError):
        return {}
    by_name = {}
    for a in attrs:
        name = a.get("name")
        if not name:
            continue
        # Only attributes the API lets you write are worth editing.
        if str(a.get("write", "true")).lower() == "false":
            continue
        by_name[name] = {
            "label": a.get("localized-label") or name,
            "options": _supported_values(a),
        }
    return by_name


def _price_type_options(metadata: dict | None) -> list[dict]:
    if not metadata:
        return []
    try:
        ad = next(iter(metadata.values()))["value"]
        return _supported_values(ad["price"]["price-type"])
    except (StopIteration, KeyError, TypeError):
        return []


def extract_fields(source_xml: str, metadata: dict | None = None) -> dict:
    """Return a labelled, editable representation of the ad."""
    root = ET.fromstring(source_xml)

    price = root.find(qn("ad", "price"))
    category = root.find(qn("cat", "category"))
    location = root.find(qn("loc", "locations") + "/" + qn("loc", "location"))

    meta_attrs = _metadata_attributes(metadata)
    attributes = []
    attrs_el = root.find(qn("attr", "attributes"))
    if attrs_el is not None:
        for a in attrs_el.findall(qn("attr", "attribute")):
            name = a.get("name", "")
            value_el = a.find(qn("attr", "value"))
            meta = meta_attrs.get(name, {})
            attributes.append({
                "name": name,
                "label": meta.get("label") or a.get("localized-label") or name,
                "value": (value_el.text or "").strip() if value_el is not None else "",
                "options": meta.get("options", []),
            })

    pictures = []
    pics_el = root.find(qn("pic", "pictures"))
    if pics_el is not None:
        for i, pic in enumerate(pics_el.findall(qn("pic", "picture"))):
            thumb = ""
            for link in pic.findall(qn("pic", "link")):
                href = link.get("href", "")
                if link.get("rel") in ("teaser", "thumbnail", "large") and "{" not in href:
                    thumb = href
                    if link.get("rel") == "teaser":
                        break
            pictures.append({"index": i, "thumb": thumb})

    return {
        "title": html.unescape(_text(root, "ad:title")),
        "description": description_to_text(_text(root, "ad:description")),
        "price": {
            "amount": _text(price, "types:amount"),
            "type": _text(price, "types:price-type", "types:value"),
            "type_options": _price_type_options(metadata),
        },
        "contact_name": html.unescape(_text(root, "ad:contact-name")),
        "zip_code": _text(root, "ad:ad-address", "types:zip-code"),
        "category": {
            "id": category.get("id") if category is not None else "",
            "label": _text(category, "cat:localized-name"),
        },
        "location": {
            "id": location.get("id") if location is not None else "",
            "label": _text(location, "loc:localized-name"),
        },
        "attributes": attributes,
        "pictures": pictures,
    }


def category_id(source_xml: str) -> str:
    root = ET.fromstring(source_xml)
    cat = root.find(qn("cat", "category"))
    return cat.get("id", "") if cat is not None else ""


def apply_edits(out: ET.Element, edits: dict) -> None:
    """Apply edited values onto the built create XML element (in place)."""
    if not edits:
        return

    def set_text(node, value):
        if node is not None and value is not None:
            node.text = value

    if "title" in edits:
        set_text(out.find(qn("ad", "title")), edits["title"])
    if "description" in edits:
        set_text(out.find(qn("ad", "description")),
                 text_to_description(edits["description"]))
    if "contact_name" in edits:
        set_text(out.find(qn("ad", "contact-name")), edits["contact_name"])

    price = out.find(qn("ad", "price"))
    if price is not None:
        if edits.get("price_amount") is not None:
            set_text(price.find(qn("types", "amount")), str(edits["price_amount"]))
        if edits.get("price_type"):
            set_text(price.find(qn("types", "price-type") + "/" + qn("types", "value")),
                     edits["price_type"])

    if edits.get("zip_code"):
        addr = out.find(qn("ad", "ad-address"))
        if addr is not None:
            set_text(addr.find(qn("types", "zip-code")), edits["zip_code"])

    attr_edits = edits.get("attributes") or {}
    attrs_el = out.find(qn("attr", "attributes"))
    if attrs_el is not None and attr_edits:
        for a in attrs_el.findall(qn("attr", "attribute")):
            name = a.get("name")
            if name in attr_edits:
                set_text(a.find(qn("attr", "value")), str(attr_edits[name]))
