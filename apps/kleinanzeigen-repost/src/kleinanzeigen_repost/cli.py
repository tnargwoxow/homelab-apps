"""``ka-repost`` command-line entrypoint."""

from __future__ import annotations

import argparse
import os
import sys

from .client import KleinanzeigenClient, KleinanzeigenError
from .repost import parse_ad_id, repost


def _load_dotenv() -> None:
    """Minimal .env loader (avoids a hard dependency on python-dotenv)."""
    for path in (".env", os.path.join(os.path.dirname(__file__), "..", "..", ".env")):
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip("'\""))
        break


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="ka-repost",
        description="Duplicate (repost) an existing Kleinanzeigen listing.",
    )
    parser.add_argument("ad", help="ad id or full kleinanzeigen.de listing URL")
    parser.add_argument(
        "--delete-original",
        action="store_true",
        help="delete the source ad after the new one is created",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="log in, fetch the ad, verify its images are downloadable, and "
        "print the ad XML — without uploading images or creating anything",
    )
    args = parser.parse_args(argv)

    _load_dotenv()
    email = os.environ.get("KA_EMAIL")
    password = os.environ.get("KA_PASSWORD")
    token = os.environ.get("KA_TOKEN")  # optional: skip the gated login endpoint
    if not email or not (password or token):
        parser.error(
            "set KA_EMAIL and KA_PASSWORD (env or .env), or KA_EMAIL + KA_TOKEN"
        )

    try:
        ad_id = parse_ad_id(args.ad)
    except ValueError as exc:
        parser.error(str(exc))

    try:
        client = KleinanzeigenClient(email, password or "", token=token)
        result = repost(client, ad_id, dry_run=args.dry_run)

        if args.dry_run:
            print(result)
            return 0

        print(f"Reposted ad {ad_id} -> new ad {result}")
        if args.delete_original:
            client.delete_ad(ad_id)
            print(f"Deleted original ad {ad_id}")
        return 0
    except KleinanzeigenError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
