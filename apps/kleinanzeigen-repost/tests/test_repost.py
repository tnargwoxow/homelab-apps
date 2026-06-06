"""Offline unit tests — no network, no credentials required."""

from __future__ import annotations

import os
import xml.etree.ElementTree as ET

import pytest

from kleinanzeigen_repost import pictures
from kleinanzeigen_repost.namespaces import local_name, qn
from kleinanzeigen_repost.repost import parse_ad_id, sanitize_ad_xml

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "sample_ad.xml")


@pytest.fixture
def sample_xml() -> str:
    with open(FIXTURE, encoding="utf-8") as fh:
        return fh.read()


# -- parse_ad_id --------------------------------------------------------------


@pytest.mark.parametrize(
    "arg,expected",
    [
        ("2961234567", "2961234567"),
        ("  2961234567 ", "2961234567"),
        (
            "https://www.kleinanzeigen.de/s-anzeige/schoener-holztisch/2961234567-217-1234",
            "2961234567",
        ),
        (
            "https://www.kleinanzeigen.de/s-anzeige/title/2961234567-217-1234?utm=x",
            "2961234567",
        ),
    ],
)
def test_parse_ad_id(arg, expected):
    assert parse_ad_id(arg) == expected


def test_parse_ad_id_invalid():
    with pytest.raises(ValueError):
        parse_ad_id("not-an-ad")


# -- sanitize_ad_xml ----------------------------------------------------------


def test_sanitize_strips_readonly_fields(sample_xml):
    out = sanitize_ad_xml(sample_xml)
    root = ET.fromstring(out)

    assert "id" not in root.attrib
    assert "version" not in root.attrib

    locals_present = {local_name(c.tag) for c in root}
    assert "ad-status" not in locals_present
    assert "start-date-time" not in locals_present
    assert "user-id" not in locals_present
    assert "link" not in locals_present

    # Content fields survive.
    assert "title" in locals_present
    assert "description" in locals_present
    assert "price" in locals_present


def test_sanitize_replaces_pictures(sample_xml):
    new_pics = pictures.build_pictures_element(
        [[("XXL", "https://new.example/img1.jpg")]]
    )
    out = sanitize_ad_xml(sample_xml, pictures=new_pics)
    root = ET.fromstring(out)

    pic_blocks = [c for c in root if c.tag == qn("pic", "pictures")]
    assert len(pic_blocks) == 1
    hrefs = [lk.get("href") for lk in pic_blocks[0].iter(qn("pic", "link"))]
    assert hrefs == ["https://new.example/img1.jpg"]


# -- picture helpers ----------------------------------------------------------


def test_extract_picture_urls_picks_largest(sample_xml):
    urls = pictures.extract_picture_urls(sample_xml)
    assert len(urls) == 2
    assert all("rule=$_59.JPG" in u for u in urls)  # the XXL variant


def test_extract_uploaded_links_list_shape():
    resp = {
        "pictures": {
            "picture": [
                {"link": [{"rel": "XXL", "href": "https://x/1.jpg"}]}
            ]
        }
    }
    assert pictures.extract_uploaded_links(resp) == [("XXL", "https://x/1.jpg")]


def test_extract_uploaded_links_single_object_at_sign_keys():
    resp = {"picture": {"link": {"@rel": "L", "@href": "https://x/2.jpg"}}}
    assert pictures.extract_uploaded_links(resp) == [("L", "https://x/2.jpg")]


def test_build_pictures_element_structure():
    el = pictures.build_pictures_element(
        [
            [("teaser", "https://x/t.jpg"), ("XXL", "https://x/big.jpg")],
            [("XXL", "https://y/big.jpg")],
        ]
    )
    assert el.tag == qn("pic", "pictures")
    pic_children = el.findall(qn("pic", "picture"))
    assert len(pic_children) == 2
    first_links = pic_children[0].findall(qn("pic", "link"))
    assert [lk.get("href") for lk in first_links] == [
        "https://x/t.jpg",
        "https://x/big.jpg",
    ]
