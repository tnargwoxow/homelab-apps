"""ECG (eBay Classifieds Group) XML namespaces used by the Kleinanzeigen API.

Registered with ElementTree so re-serialized ad XML keeps the original prefixes
the server expects.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

NS = {
    "ad": "http://www.ebayclassifiedsgroup.com/schema/ad/v1",
    "cat": "http://www.ebayclassifiedsgroup.com/schema/category/v1",
    "loc": "http://www.ebayclassifiedsgroup.com/schema/location/v1",
    "attr": "http://www.ebayclassifiedsgroup.com/schema/attribute/v1",
    "pic": "http://www.ebayclassifiedsgroup.com/schema/picture/v1",
    "user": "http://www.ebayclassifiedsgroup.com/schema/user/v1",
    "types": "http://www.ebayclassifiedsgroup.com/schema/types/v1",
}

for _prefix, _uri in NS.items():
    ET.register_namespace(_prefix, _uri)


def qn(prefix: str, local: str) -> str:
    """Build a Clark-notation qualified name, e.g. qn('pic', 'pictures')."""
    return f"{{{NS[prefix]}}}{local}"


def local_name(tag: str) -> str:
    """Strip the namespace from an ElementTree tag, returning the local part."""
    return tag.rsplit("}", 1)[-1]
