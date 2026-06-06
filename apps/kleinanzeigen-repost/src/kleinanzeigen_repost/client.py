"""Low-level HTTP client for the Kleinanzeigen (eBay Classifieds Group) mobile API.

This talks to the same internal REST API the official Kleinanzeigen Android/iOS
apps use. It is not officially documented; the request flow below is a faithful
port of the reverse-engineered reference client at
https://github.com/tejado/ebk-client .

Auth is two-layered:

* a *partner* credential baked into the mobile app (Basic auth + the
  ``X-EBAYK-APP`` header). The known values are the module-level ``APP_*`` /
  ``H_*`` defaults and can be overridden via environment variables when they
  eventually rotate.
* a *user* credential (your own Kleinanzeigen account). We log in once with the
  SHA1-hashed password and swap in the returned session token for every later
  request.
"""

from __future__ import annotations

import base64
import hashlib
import os

import requests

URL_PREFIX = "https://api.ebay-kleinanzeigen.de/api"

# Hardcoded partner-app constants extracted from the official Android app.
# The app *version* matters: Kleinanzeigen rejects outdated client identifiers
# (the old "ebayk-android-app-13.4.2") with a misleading "IP-Bereich gesperrt"
# 403, so X-ECG-USER-AGENT must track a current-ish app version. Override via
# env vars if Kleinanzeigen rotates them (see README).
H_EBAYK_CLIENT_APP = os.environ.get(
    "KA_APP_ID", "13a6dde3-935d-4cd8-9992-db8a8c4b6c0f1456515662229"
)
H_EBAYK_CLIENT_VERSION = os.environ.get("KA_APP_VERSION", "100.9.0")
H_EBAYK_CLIENT_TYPE = os.environ.get(
    "KA_APP_TYPE", "ebayk-android-app-100.9.0"
)
H_EBAYK_CLIENT_UA = os.environ.get("KA_APP_UA", "Dalvik/2.2.0")
H_EBAYK_WENKSE_SESSION_ID = os.environ.get("KA_WENKSE_SESSION_ID", "asd")

# Partner Basic-auth credentials (the app's own account, NOT the end user's).
APP_USERNAME = os.environ.get("KA_APP_USERNAME", "android")
APP_PASSWORD = os.environ.get("KA_APP_PASSWORD", "TaR60pEttY")


class KleinanzeigenError(RuntimeError):
    """Raised when the API returns a non-2xx response.

    The original status code and response body are attached so callers can see
    the (often useful) XML error message the server returns.
    """

    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        self.body = body
        super().__init__(f"HTTP {status_code}: {body}")


class KleinanzeigenClient:
    def __init__(
        self,
        email: str,
        password: str,
        app_username: str = APP_USERNAME,
        app_password: str = APP_PASSWORD,
        token: str | None = None,
    ):
        if not email:
            raise ValueError("email is required")
        if not password and not token:
            raise ValueError("either password or token is required")

        self.username = email

        app_auth = base64.b64encode(
            f"{app_username}:{app_password}".encode("ascii")
        ).decode("utf-8")

        self._session = requests.Session()
        self._session.headers.update(
            {
                "X-EBAYK-APP": H_EBAYK_CLIENT_APP,
                "X-ECG-USER-VERSION": H_EBAYK_CLIENT_VERSION,
                "X-ECG-USER-AGENT": H_EBAYK_CLIENT_TYPE,
                "Authorization": f"Basic {app_auth}",
                "X-EBAYK-WENKSE-SESSION-ID": H_EBAYK_WENKSE_SESSION_ID,
                "User-Agent": H_EBAYK_CLIENT_UA,
            }
        )

        if token:
            # Skip the heavily anti-fraud-gated /users/login endpoint and use a
            # session token captured from the app (see README, KA_TOKEN).
            self._session.headers["X-ECG-Authorization-User"] = (
                f'email="{email}",token="{token}"'
            )
            return

        hashed_pw = base64.b64encode(
            hashlib.sha1(password.encode("ascii")).digest()
        ).decode("utf-8")
        self._session.headers["X-ECG-Authorization-User"] = (
            f'email="{email}",password="{hashed_pw}"'
        )

        # Log in: the session token comes back in the X-EBAYK-TOKEN header.
        resp = self._get("/users/login")
        new_token = resp.headers.get("X-EBAYK-TOKEN")
        if not new_token:
            raise KleinanzeigenError(
                resp.status_code, "login succeeded but no X-EBAYK-TOKEN header returned"
            )
        self._session.headers["X-ECG-Authorization-User"] = (
            f'email="{email}",token="{new_token}"'
        )

    # -- internal HTTP helpers -------------------------------------------------

    @staticmethod
    def _check(resp: requests.Response) -> requests.Response:
        if not resp.ok:
            body = resp.text
            if resp.status_code == 403 and "gesperrt" in body:
                body = (
                    "Kleinanzeigen temporarily blocked this IP range "
                    '("IP-Bereich vorübergehend gesperrt"). This is an '
                    "anti-fraud rate block, not a credentials problem. It is "
                    "common on shared mobile/CGNAT and VPN/datacenter IPs and "
                    "after many requests in a short window. Wait ~15-60 min and "
                    "retry from a residential connection, or capture a session "
                    "token from the app and set KA_TOKEN to skip login. "
                    f"(raw: {resp.text.strip()[:200]})"
                )
            raise KleinanzeigenError(resp.status_code, body)
        return resp

    def _get(self, suffix: str) -> requests.Response:
        return self._check(self._session.get(URL_PREFIX + suffix))

    def _post_xml(self, suffix: str, xml: str) -> requests.Response:
        return self._check(
            self._session.post(
                URL_PREFIX + suffix,
                data=xml.encode("utf-8"),
                headers={"Content-Type": "application/xml"},
            )
        )

    def _post_file(self, suffix: str, filename: str, data: bytes) -> requests.Response:
        # multipart upload — do NOT set Content-Type, requests builds the
        # multipart boundary itself.
        return self._check(
            self._session.post(
                URL_PREFIX + suffix, files={"file": (filename, data)}
            )
        )

    def _delete(self, suffix: str) -> requests.Response:
        return self._check(self._session.delete(URL_PREFIX + suffix))

    # -- public API ------------------------------------------------------------

    def get_ad_xml(self, ad_id: str) -> str:
        """Return the raw XML representation of an existing ad."""
        return self._get(f"/ads/{ad_id}").text

    def get_my_ads(self) -> requests.Response:
        return self._get(
            f"/users/{self.username}/ads.json"
            "?_in=id,title,start-date-time,ad-status"
        )

    def upload_picture(self, filename: str, data: bytes) -> dict:
        """Upload one image, returning the parsed JSON picture descriptor."""
        return self._post_file("/pictures.json", filename, data).json()

    def create_ad(self, xml: str) -> requests.Response:
        """Create (post) a new ad from a full ad XML body."""
        return self._post_xml(f"/users/{self.username}/ads.json", xml)

    def delete_ad(self, ad_id: str) -> bool:
        return self._delete(f"/users/{self.username}/ads/{ad_id}").status_code == 204
