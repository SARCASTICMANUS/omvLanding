import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)

# RFC 6455 close codes in the private-use range, mirroring the codes already
# used by NotificationConsumer so client-side handling stays uniform.
WS_CLOSE_UNAUTHENTICATED = 4001
WS_CLOSE_FORBIDDEN = 4003

WS_SUBPROTOCOL = getattr(settings, "WS_SUBPROTOCOL", "vayy.jwt.v1")


def token_from_scope(scope):
    """
    Resolve a WebSocket JWT from a Channels scope.

    Order of preference:
      1. ``Sec-WebSocket-Protocol`` - the client offers
         ``["vayy.jwt.v1", "<jwt>"]``. This is the transport we want: the
         token never appears in the URL, so it stays out of access logs.
      2. ``?token=`` - legacy, only while WS_ALLOW_QUERY_STRING_TOKEN is on.

    Returns ``(token, from_legacy_transport)``.
    """
    offered = scope.get("subprotocols") or []
    for value in offered:
        if not value or value == WS_SUBPROTOCOL:
            continue
        # Skip any other label the client may have offered alongside the token.
        if value.startswith("vayy."):
            continue
        return value.strip(), False

    if not getattr(settings, "WS_ALLOW_QUERY_STRING_TOKEN", False):
        return None, False

    from urllib.parse import parse_qs

    query_string = scope.get("query_string", b"").decode()
    params = parse_qs(query_string)
    token = params.get("token", [None])[0]
    # Only report the legacy transport when a token actually came from it,
    # so callers never log "authenticated via query string" for a client that
    # sent no credentials at all.
    return (token, True) if token else (None, False)


def subprotocol_to_echo(scope):
    """
    The handshake must echo one of the subprotocols the client offered, or the
    browser aborts. We echo the stable label and never the JWT itself.
    """
    return WS_SUBPROTOCOL if WS_SUBPROTOCOL in (scope.get("subprotocols") or []) else None



class BaseAuthenticatedConsumer(AsyncWebsocketConsumer):
    """
    Base consumer with JWT authentication *and* resource authorization.

    Authentication alone is not authorization: a valid token only proves *who*
    the caller is, never *what* they may observe. Historically this class set
    ``scope['user']`` and let every subclass join any group named by its URL,
    so any authenticated user could subscribe to any dispatch, trip, or vehicle
    feed - including trip OTPs and passenger pickup coordinates.

    Subclasses opt into an ownership check by setting ``owner_resolver`` to an
    async callable ``(user, **path_kwargs) -> bool``. Resolvers run *before*
    the handshake is accepted, so an unauthorized subscriber never becomes a
    group member and never receives a single message.

    Token transport: the token is read from the ``Sec-WebSocket-Protocol``
    header, never from the query string, because query strings land in
    nginx/Daphne access logs, browser history and proxy referrers. Browsers
    cannot set arbitrary headers on a WebSocket handshake, which is why the
    subprotocol channel exists. The query-string form is still readable but
    only while ``WS_ALLOW_QUERY_STRING_TOKEN`` is on, so a client fleet can be
    migrated without a flag-day outage; turn it off once every client sends the
    header.
    """

    # async (user, **url_kwargs) -> bool. None disables the check, which is
    # only safe for consumers whose group is derived from the caller's own id.
    owner_resolver = None

    # Label used in log lines, e.g. resource_name = "trip".
    resource_name = "resource"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Subclasses branch on this instead of re-checking scope['user'].
        self.authorized = False

    # ── token transport ──────────────────────────────────────

    def _extract_token(self):
        token, legacy = token_from_scope(self.scope)
        if token and legacy:
            logger.warning(
                "WebSocket authenticated via query-string token for %s. This "
                "transport leaks credentials into access logs; migrate the "
                "client to Sec-WebSocket-Protocol and set "
                "WS_ALLOW_QUERY_STRING_TOKEN = False.",
                type(self).__name__,
            )
        return token

    # ── authorization ────────────────────────────────────────

    def _url_kwargs(self):
        return (self.scope.get("url_route") or {}).get("kwargs") or {}

    async def _is_expected_owner(self, user):
        """
        Run the subclass resolver. Any error is a denial, never a bypass: a
        resolver that blows up must not fall through to an open group.
        """
        if self.owner_resolver is None:
            return True
        try:
            return bool(await self.owner_resolver(user, **self._url_kwargs()))
        except Exception:
            logger.exception(
                "Authorization resolver failed for %s (%s); denying.",
                type(self).__name__,
                self.resource_name,
            )
            return False

    # ── handshake ────────────────────────────────────────────

    async def connect(self):
        token = self._extract_token()
        if not token:
            await self.close(code=WS_CLOSE_UNAUTHENTICATED)
            return

        user = await self.authenticate_token(token)
        if not user:
            logger.warning("WebSocket connection attempt with invalid token")
            await self.close(code=WS_CLOSE_UNAUTHENTICATED)
            return

        self.scope["user"] = user
        # Channels does not expose scope entries as attributes, so set this
        # explicitly: existing consumers read self.user.id.
        self.user = user

        if not await self._is_expected_owner(user):
            logger.warning(
                "User %s denied %s access to %s",
                user.id,
                self.resource_name,
                self._url_kwargs(),
            )
            await self.close(code=WS_CLOSE_FORBIDDEN)
            return

        # Echo the subprotocol label when the client offered it; browsers reject
        # the handshake if we return a protocol the client did not ask for.
        await self.accept(subprotocol=subprotocol_to_echo(self.scope))
        self.authorized = True
        logger.info("User %s connected to %s WebSocket", user.id, self.resource_name)

    @database_sync_to_async
    def authenticate_token(self, token):
        try:
            auth = JWTAuthentication()
            validated_token = auth.get_validated_token(token)
            return auth.get_user(validated_token)
        except Exception:
            return None
