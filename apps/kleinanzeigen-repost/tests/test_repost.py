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
    # server-managed fields stripped (incl. modern ones)
    for stripped in (
        "ad-status", "start-date-time", "user-id", "link",
        "userBadges", "displayoptions", "tracking",
        "contact-name-initials", "seller-account-type",
    ):
        assert stripped not in locals_present, stripped

    # Content fields survive (including contact-name, which is NOT read-only).
    for kept in ("title", "description", "price", "contact-name"):
        assert kept in locals_present, kept


def test_sanitize_replaces_pictures(sample_xml):
    new_pics = ET.Element(qn("pic", "pictures"))
    pic = ET.SubElement(new_pics, qn("pic", "picture"))
    ET.SubElement(pic, qn("pic", "link")).set("href", "https://new.example/img1.jpg")

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


def test_new_base_url_unwraps_jaxb_envelope():
    resp = {
        "{http://.../picture/v1}picture": {
            "value": {
                "link": [
                    {"rel": "thumbnail", "href": "https://img/AB/uuid?AccessKeyId=x&jwt=y"},
                    {"rel": "XXL", "href": "https://img/AB/uuid?rule=$_57.JPG"},
                ]
            }
        }
    }
    assert pictures.new_base_url(resp) == "https://img/AB/uuid"


class _FakeClient:
    """Captures uploads and returns a JAXB-style response with a new base URL."""

    def __init__(self):
        self.uploads = []

    def upload_picture(self, filename, data):
        n = len(self.uploads)
        self.uploads.append((filename, data))
        return {
            "{ns}picture": {
                "value": {"link": [{"rel": "XXL", "href": f"https://img/new{n}?rule=$_57.JPG"}]}
            }
        }


def test_rehost_pictures_clones_with_new_base(monkeypatch, sample_xml):
    monkeypatch.setattr(pictures, "download", lambda url, session=None: b"bytes")
    client = _FakeClient()
    out = pictures.rehost_pictures(client, sample_xml)

    pics = out.findall(qn("pic", "picture"))
    assert len(pics) == 2  # fixture has two pictures
    assert len(client.uploads) == 2  # each downloaded + uploaded

    # First picture's links keep their ?rule suffixes but point at the new base.
    first = [lk.get("href") for lk in pics[0].findall(qn("pic", "link"))]
    assert all(h.startswith("https://img/new0") for h in first)
    assert any(h.endswith("?rule=$_59.JPG") for h in first)  # original suffix kept
