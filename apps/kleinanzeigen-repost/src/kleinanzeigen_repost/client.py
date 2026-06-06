"""Low-level HTTP client for the Kleinanzeigen mobile API (modern auth).

The Kleinanzeigen Android app authenticates with **Auth0 OAuth2** (white-labelled
at ``login.kleinanzeigen.de``). The data API (``api.kleinanzeigen.de``) then
accepts the resulting access token via the ``X-ECG-Authorization-User`` header
alongside the app's static partner Basic credential.

We never run the interactive login (it is Akamai bot-protected). Instead we hold
a long-lived **refresh token** (captured once from the app) and mint a fresh
1-hour access token on every run via ``POST /oauth/token`` — that endpoint is not
bot-gated and works from plain Python. The refresh token is non-rotating, so the
same one keeps working until you log out of the app or it hits an absolute
expiry.

Auth header shape (verified by intercepting the app):

    Authorization: Basic base64(android:TaR60pEttY)
    X-ECG-Authorization-User: email=<email>,access=<access-jwt>
"""

from __future__ import annotations

import base64
import json
import os

import requests

URL_PREFIX = "https://api.kleinanzeigen.de/api"
OAUTH_TOKEN_URL = "https://login.kleinanzeigen.de/oauth/token"

# Auth0 public PKCE client id of the official Android app.
DEFAULT_CLIENT_ID = os.environ.get(
    "KA_CLIENT_ID", "uV5j90myVPc2XzEOFuWUD2At17OACEGQ"
)

# The access-token claim that carries the numeric Kleinanzeigen user id.
USER_ID_CLAIM = "https://www.kleinanzeigen.de/user_id"

# Static partner Basic-auth credential (the app's own account, NOT the user's).
APP_USERNAME = os.environ.get("KA_APP_USERNAME", "android")
APP_PASSWORD = os.environ.get("KA_APP_PASSWORD", "TaR60pEttY")
# Current-ish app version string (sent for legitimacy, not strictly required).
H_CLIENT_VERSION = os.environ.get("KA_APP_VERSION", "2026.23.1")
H_CLIENT_TYPE = os.environ.get("KA_APP_TYPE", "ebayk-android-app-2026.23.1")
H_CLIENT_UA = os.environ.get(
    "KA_APP_UA", "Kleinanzeigen/2026.23.1 (Android 16; samsung SM-S928B)"
)


class KleinanzeigenError(RuntimeError):
    """Raised when the API returns a non-2xx response (body attached)."""

    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        self.body = body
        super().__init__(f"HTTP {status_code}: {body}")


def _decode_jwt_payload(token: str) -> dict:
    """Decode the (unverified) payload of a JWT."""
    part = token.split(".")[1]
    part += "=" * (-len(part) % 4)
    return json.loads(base64.urlsafe_b64decode(part))


class KleinanzeigenClient:
    def __init__(
        self,
        refresh_token: str,
        client_id: str = DEFAULT_CLIENT_ID,
        email: str | None = None,
        user_id: str | None = None,
        app_username: str = APP_USERNAME,
        app_password: str = APP_PASSWORD,
    ):
        if not refresh_token:
            raise ValueError("a refresh token is required")

        access_token, id_token = self._mint_access_token(refresh_token, client_id)

        claims = _decode_jwt_payload(access_token)
        self.user_id = user_id or str(claims.get(USER_ID_CLAIM, "")).strip()
        if not email and id_token:
            email = _decode_jwt_payload(id_token).get("email")
        self.email = email
        if not self.user_id:
            raise KleinanzeigenError(0, "could not determine user id from token")
        if not self.email:
            raise KleinanzeigenError(0, "could not determine email (set KA_EMAIL)")

        app_auth = base64.b64encode(
            f"{app_username}:{app_password}".encode("ascii")
        ).decode("utf-8")

        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Basic {app_auth}",
                "X-ECG-Authorization-User": f"email={self.email},access={access_token}",
                "X-ECG-USER-VERSION": H_CLIENT_VERSION,
                "X-ECG-USER-AGENT": H_CLIENT_TYPE,
                "User-Agent": H_CLIENT_UA,
            }
        )

    # -- auth ------------------------------------------------------------------

    @staticmethod
    def _mint_access_token(refresh_token: str, client_id: str) -> tuple[str, str | None]:
        """Exchange the refresh token for a fresh access token."""
        resp = requests.post(
            OAUTH_TOKEN_URL,
            json={
                "client_id": client_id,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=30,
        )
        if not resp.ok:
            raise KleinanzeigenError(
                resp.status_code,
                "token refresh failed (refresh token expired/revoked? "
                f"re-capture needed): {resp.text.strip()[:200]}",
            )
        data = resp.json()
        return data["access_token"], data.get("id_token")

    # -- internal HTTP helpers -------------------------------------------------

    @staticmethod
    def _check(resp: requests.Response) -> requests.Response:
        if not resp.ok:
            raise KleinanzeigenError(resp.status_code, resp.text)
        return resp

    def _get(self, suffix: str, **kwargs) -> requests.Response:
        return self._check(self._session.get(URL_PREFIX + suffix, **kwargs))

    def _post_xml(self, suffix: str, xml: str) -> requests.Response:
        return self._check(
            self._session.post(
                URL_PREFIX + suffix,
                data=xml.encode("utf-8"),
                headers={"Content-Type": "application/xml"},
            )
        )

    def _post_file(self, suffix: str, filename: str, data: bytes) -> requests.Response:
        # multipart upload — let requests build the boundary.
        return self._check(
            self._session.post(URL_PREFIX + suffix, files={"file": (filename, data)})
        )

    def _delete(self, suffix: str) -> requests.Response:
        return self._check(self._session.delete(URL_PREFIX + suffix))

    # -- public API ------------------------------------------------------------

    def get_ad_xml(self, ad_id: str) -> str:
        """Return the XML representation of one of the user's own ads."""
        return self._get(
            f"/users/{self.user_id}/ads/{ad_id}",
            headers={"Accept": "application/xml"},
        ).text

    def upload_picture(self, filename: str, data: bytes) -> dict:
        """Upload one image, returning the parsed JSON picture descriptor."""
        return self._post_file("/pictures.json", filename, data).json()

    def create_ad(self, xml: str) -> requests.Response:
        """Create (post) a new ad from a full ad XML body."""
        return self._post_xml(f"/users/{self.user_id}/ads.json", xml)

    def delete_ad(self, ad_id: str) -> bool:
        return (
            self._delete(f"/users/{self.user_id}/ads/{ad_id}").status_code == 204
        )
