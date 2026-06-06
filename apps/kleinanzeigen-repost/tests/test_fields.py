"""Offline tests for field extraction + applying edits."""

from __future__ import annotations

import os
import xml.etree.ElementTree as ET

import pytest

from kleinanzeigen_repost import fields
from kleinanzeigen_repost.namespaces import qn
from kleinanzeigen_repost.repost import sanitize_ad_xml

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "sample_ad.xml")


@pytest.fixture
def sample_xml() -> str:
    with open(FIXTURE, encoding="utf-8") as fh:
        return fh.read()


def test_description_roundtrip():
    assert fields.description_to_text("Line A<br/>Line B<br />C") == "Line A\nLine B\nC"
    assert fields.text_to_description("a\nb") == "a<br/>b"
    # XML-decoded text (one layer already removed by the parser) html-decodes
    assert fields.description_to_text("Creme&#x2F;Off") == "Creme/Off"


def test_extract_fields_basic(sample_xml):
    f = fields.extract_fields(sample_xml)
    assert f["title"] == "Schöner Holztisch"
    assert "Eiche" in f["description"]
    assert f["price"]["amount"] == "120"
    assert f["price"]["type"] == "FIXED"
    assert f["contact_name"] == "Tester"
    assert f["category"]["id"] == "80"
    assert f["location"]["id"] == "3331"
    assert len(f["pictures"]) == 2
    assert f["pictures"][0]["thumb"].startswith("https://img.kleinanzeigen.de")


def test_extract_fields_attribute_options_from_metadata():
    xml = (
        '<ad:ad xmlns:ad="http://www.ebayclassifiedsgroup.com/schema/ad/v1"'
        ' xmlns:attr="http://www.ebayclassifiedsgroup.com/schema/attribute/v1">'
        '<ad:title>x</ad:title>'
        '<attr:attributes><attr:attribute name="wz.color">'
        '<attr:value>beige</attr:value></attr:attribute></attr:attributes>'
        "</ad:ad>"
    )
    metadata = {
        "{ns}ad": {
            "value": {
                "attributes": {
                    "attribute": [
                        {
                            "name": "wz.color",
                            "localized-label": "Farbe",
                            "write": "true",
                            "supported-value": [
                                {"value": "beige", "localized-label": "Beige"},
                                {"value": "blau", "localized-label": "Blau"},
                            ],
                        }
                    ]
                }
            }
        }
    }
    f = fields.extract_fields(xml, metadata)
    attr = f["attributes"][0]
    assert attr["label"] == "Farbe"
    assert attr["value"] == "beige"
    assert {o["value"] for o in attr["options"]} == {"beige", "blau"}


def test_sanitize_applies_edits(sample_xml):
    new_pics = ET.Element(qn("pic", "pictures"))
    edits = {
        "title": "Brand new title",
        "description": "First line\nSecond line",
        "price_amount": "999",
        "price_type": "PLEASE_CONTACT",
        "contact_name": "Editor",
    }
    out = sanitize_ad_xml(sample_xml, pictures=new_pics, edits=edits)
    root = ET.fromstring(out)

    def text(*path):
        node = root
        for p in path:
            node = node.find(p)
        return node.text if node is not None else None

    assert text(qn("ad", "title")) == "Brand new title"
    assert text(qn("ad", "description")) == "First line<br/>Second line"
    assert text(qn("ad", "price"), qn("types", "amount")) == "999"
    assert text(qn("ad", "price"), qn("types", "price-type"), qn("types", "value")) \
        == "PLEASE_CONTACT"
    assert text(qn("ad", "contact-name")) == "Editor"
