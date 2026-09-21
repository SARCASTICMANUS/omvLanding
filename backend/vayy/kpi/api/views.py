import hashlib
import logging
import re
from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Avg, Count, Sum
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from common.constants import (
    TRIP_STATUS_ACTIVE,
    TRIP_STATUS_ARRIVED,
    TRIP_STATUS_CANCELLED,
    TRIP_STATUS_COMPLETED,
)
from kpi.api.serializers import KPISnapshotSerializer, PageViewSerializer
from kpi.models import KPISnapshot, PageView
from operations.models import ActiveTrip, BoardingRequest, Vehicle
from transport.models import City, Route, Stop, TripSchedule

logger = logging.getLogger(__name__)

User = get_user_model()

VISITOR_COOKIE = "vayy_vid"
VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60  # 1 year

# ─── Cache config ────────────────────────────────────────
ADMIN_STATS_CACHE_KEY = "admin:entity_stats"
ADMIN_STATS_CACHE_TTL = 300  # 5 minutes

# ─── User-Agent parser ──────────────────────────────────
_BROWSER_PATTERNS = [
    (r"Brave/([\d.]+)", "Brave"),
    (r"Edg(?:e|)/([\d.]+)", "Edge"),
    (r"OPR/([\d.]+)", "Opera"),
    (r"Chrome/([\d.]+)", "Chrome"),
    (r"Firefox/([\d.]+)", "Firefox"),
    (r"Version/([\d.]+).*Safari", "Safari"),
    (r"MSIE ([\d.]+)|Trident/.*rv:([\d.]+)", "IE"),
]

_OS_PATTERNS = [
    (r"Windows NT 10\.0", "Windows 10"),
    (r"Windows NT 6\.3", "Windows 8.1"),
    (r"Windows NT 6\.2", "Windows 8"),
    (r"Windows NT 6\.1", "Windows 7"),
    (r"Mac OS X ([\d_]+)", "macOS"),
    (r"Android ([\d.]+)", "Android"),
    (r"iPhone OS ([\d_]+)", "iOS"),
    (r"Linux", "Linux"),
    (r"CrOS", "Chrome OS"),
]


def _parse_browser(user_agent: str) -> str:
    """Extract browser name from User-Agent string."""
    for pattern, name in _BROWSER_PATTERNS:
        if re.search(pattern, user_agent):
            return name
    return "Other"


def _parse_os(user_agent: str) -> str:
    """Extract OS name from User-Agent string."""
    for pattern, name in _OS_PATTERNS:
        if re.search(pattern, user_agent):
            return name
    return "Other"


# ─── 1. Cached Admin Stats ──────────────────────────────
class AdminStatsAPI(APIView):
    """GET /api/kpi/admin-stats/ — Entity counts for the admin dashboard.

    Replaces 7 parallel API calls that fetched entire tables just to count
    array lengths. Results are cached in Redis for 5 minutes.
    """

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        cached = cache.get(ADMIN_STATS_CACHE_KEY)
        if cached is not None:
            return Response({"success": True, "data": cached})

        data = self._fetch_live_counts()
        cache.set(ADMIN_STATS_CACHE_KEY, data, ADMIN_STATS_CACHE_TTL)
        return Response({"success": True, "data": data})

    @staticmethod
    def _fetch_live_counts() -> dict[str, int]:
        from accounts.models import User
        from transport.models import City, Route, Stop, TripSchedule

        return {
            "cities": City.objects.count(),
            "routes": Route.objects.count(),
            "stops": Stop.objects.count(),
            "schedules": TripSchedule.objects.count(),
            "passengers": User.objects.filter(role="passenger").count(),
            "drivers": (
                User.objects.filter(role="bikedriver").count()
                + User.objects.filter(role="autodriver").count()
            ),
        }


# ─── 2. Async PageView Tracking ─────────────────────────
class TrackPageViewAPI(APIView):
    """POST /api/kpi/track/ — Record a page view asynchronously.

    Flow:
      1. Validate payload
      2. Extract client IP (X-Forwarded-For → REMOTE_ADDR)
      3. GeoIP lookup for country/city (~0.5ms local read)
      4. Dispatch Celery task to RabbitMQ (non-blocking)
      5. Return 202 Accepted immediately

    The Celery consumer writes the PageView row to PostgreSQL.
    """

    permission_classes = [AllowAny]
    throttle_scope = "kpi_track"

    def post(self, request: Request) -> Response:
        serializer = PageViewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Extract client IP — prefer frontend-provided public IP over Docker gateway
        client_ip = serializer.validated_data.get("client_ip", "")
        ip = client_ip or request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        if not ip:
            ip = request.META.get("REMOTE_ADDR", "")

        # Visitor identification
        visitor_id = request.COOKIES.get(VISITOR_COOKIE)
        if not visitor_id:
            fingerprint = f"{ip}-{request.META.get('HTTP_USER_AGENT', '')}"
            visitor_id = hashlib.sha256(fingerprint.encode()).hexdigest()[:32]

        # GeoIP lookup for country/city
        geo = {}
        try:
            from tracking.services.geoip_service import lookup_geoip
            geo = lookup_geoip(ip) or {}
        except Exception:
            pass

        # Build event payload
        event_payload: dict[str, Any] = {
            "platform": serializer.validated_data["platform"],
            "page": serializer.validated_data["page"],
            "visitor_id": visitor_id,
            "ip_address": ip,
            "user_agent": serializer.validated_data.get("user_agent", ""),
            "referrer": serializer.validated_data.get("referrer", ""),
            "utm_source": serializer.validated_data.get("utm_source", ""),
            "utm_medium": serializer.validated_data.get("utm_medium", ""),
            "utm_campaign": serializer.validated_data.get("utm_campaign", ""),
            "utm_term": serializer.validated_data.get("utm_term", ""),
            "utm_content": serializer.validated_data.get("utm_content", ""),
            "country": geo.get("country", ""),
            "city": geo.get("city", ""),
            "region": geo.get("region", ""),
            "country_code": geo.get("country_code", ""),
            "latitude": geo.get("latitude"),
            "longitude": geo.get("longitude"),
            "timezone": geo.get("timezone", ""),
            "device_type": serializer.validated_data.get("device_type", ""),
        }

        # Dispatch to Celery (RabbitMQ handles delivery)
        from kpi.tasks import process_pageview_event

        process_pageview_event.delay(event_payload)

        # Respond immediately — DB write happens async
        response = Response(
            {"success": True, "message": "Page view accepted"},
            status=202,
        )

        if not request.COOKIES.get(VISITOR_COOKIE):
            response.set_cookie(
                VISITOR_COOKIE,
                visitor_id,
                max_age=VISITOR_COOKIE_MAX_AGE,
                httponly=True,
                samesite="Lax",
                path="/",
            )

        return response


# ─── 3. Hybrid KPI Overview ─────────────────────────────
class KPIOverviewAPI(APIView):
    """GET /api/kpi/overview/?platform={web|app}&days={N}

    Hybrid query engine:
      - Historical data from KPISnapshot (days before today)
      - Live data from PageView (today only)
      - Combined totals returned in the response
    """

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        platform = request.query_params.get("platform", "web")
        days = int(request.query_params.get("days", 30))

        if platform == "web":
            data = self._web_metrics(days)
        else:
            data = self._app_metrics(days)

        return Response({"success": True, "data": data})

    # ── Web metrics (hybrid snapshot + live) ──────────────
    def _web_metrics(self, days: int) -> dict[str, Any]:
        today = timezone.now().date()
        today_start = timezone.now().replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        cutoff = today - timedelta(days=days)

        # ── Historical: sum from KPISnapshot (days before today) ──
        snapshot_qs = KPISnapshot.objects.filter(
            date__gte=cutoff, date__lt=today
        )
        hist = snapshot_qs.aggregate(hist_web_visits=Sum("web_visits"))
        hist_web_visits = hist["hist_web_visits"] or 0

        # ── Live: today's raw PageView counts ──
        live_today_qs = PageView.objects.filter(
            platform="web", created_at__gte=today_start
        )
        live_total = live_today_qs.count()

        # ── Combined total visits ──
        total_visits = hist_web_visits + live_total

        # ── Unique visitors + bounce rate (need full-range query) ──
        all_qs = PageView.objects.filter(
            platform="web", created_at__gte=cutoff
        )
        unique_visitors = all_qs.values("visitor_id").distinct().count()

        # Bounce rate: visitors with exactly 1 view / total unique
        visitor_views = all_qs.values("visitor_id").annotate(
            view_count=Count("id")
        )
        single_page = visitor_views.filter(view_count=1).count()
        bounce_rate = round(
            (single_page / max(unique_visitors, 1)) * 100, 1
        )

        avg_views = round(total_visits / max(unique_visitors, 1), 1)

        # Returning visitor ratio
        returning_ratio = (
            round(((total_visits - unique_visitors) / max(total_visits, 1)) * 100, 1)
            if total_visits > 0
            else 0
        )

        # Engagement rate (inverse of bounce rate)
        engagement_rate = round(100.0 - bounce_rate, 1)

        # ── Dimensional breakdowns ──
        daily = list(
            all_qs.extra(select={"day": "date(created_at)"})
            .values("day")
            .annotate(
                views=Count("id"),
                visitors=Count("visitor_id", distinct=True),
            )
            .order_by("day")
        )

        top_pages = list(
            live_today_qs.values("page")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )

        device_stats = list(
            live_today_qs.exclude(device_type="")
            .values("device_type")
            .annotate(views=Count("id"))
            .order_by("-views")[:5]
        )

        referrer_stats = list(
            all_qs.exclude(referrer="")
            .values("referrer")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )

        # Country stats with percentage
        country_stats_raw = list(
            all_qs.exclude(country="")
            .values("country")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )
        for entry in country_stats_raw:
            entry["percentage"] = round(
                (entry["views"] / max(total_visits, 1)) * 100, 1
            )

        # City stats (top 15)
        city_stats = list(
            all_qs.exclude(city="")
            .values("city")
            .annotate(views=Count("id"))
            .order_by("-views")[:15]
        )
        for entry in city_stats:
            entry["percentage"] = round(
                (entry["views"] / max(total_visits, 1)) * 100, 1
            )

        # Region stats (top 15)
        region_stats = list(
            all_qs.exclude(region="")
            .values("region")
            .annotate(views=Count("id"))
            .order_by("-views")[:15]
        )
        for entry in region_stats:
            entry["percentage"] = round(
                (entry["views"] / max(total_visits, 1)) * 100, 1
            )

        # Timezone stats
        timezone_stats = list(
            all_qs.exclude(timezone="")
            .values("timezone")
            .annotate(views=Count("id"))
            .order_by("-views")[:15]
        )

        # Browser stats (parsed from user_agent)
        browser_counts: dict[str, int] = {}
        ua_samples = list(
            live_today_qs.values_list("user_agent", flat=True)[:500]
        )
        for ua in ua_samples:
            browser = _parse_browser(ua)
            browser_counts[browser] = browser_counts.get(browser, 0) + 1
        browser_stats = [
            {"browser": b, "views": v}
            for b, v in sorted(browser_counts.items(), key=lambda x: -x[1])[:10]
        ]

        # OS stats (parsed from user_agent)
        os_counts: dict[str, int] = {}
        for ua in ua_samples:
            os_name = _parse_os(ua)
            os_counts[os_name] = os_counts.get(os_name, 0) + 1
        os_stats = [
            {"os": o, "views": v}
            for o, v in sorted(os_counts.items(), key=lambda x: -x[1])[:10]
        ]

        # UTM stats
        utm_source_stats = list(
            all_qs.exclude(utm_source="")
            .values("utm_source")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )
        utm_medium_stats = list(
            all_qs.exclude(utm_medium="")
            .values("utm_medium")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )
        utm_campaign_stats = list(
            all_qs.exclude(utm_campaign="")
            .values("utm_campaign")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )

        return {
            "platform": "web",
            "summary": {
                "total_visits": total_visits,
                "unique_visitors": unique_visitors,
                "bounce_rate": bounce_rate,
                "avg_views_per_visitor": avg_views,
                "returning_visitor_ratio": returning_ratio,
                "engagement_rate": engagement_rate,
            },
            "daily": daily,
            "top_pages": top_pages,
            "device_stats": device_stats,
            "referrer_stats": referrer_stats,
            "country_stats": country_stats_raw,
            "city_stats": city_stats,
            "region_stats": region_stats,
            "timezone_stats": timezone_stats,
            "browser_stats": browser_stats,
            "os_stats": os_stats,
            "utm_source_stats": utm_source_stats,
            "utm_medium_stats": utm_medium_stats,
            "utm_campaign_stats": utm_campaign_stats,
            "period_days": days,
        }

    # ── App metrics (transit product) ────────────────────
    def _app_metrics(self, days: int) -> dict[str, Any]:
        from accounts.models import User
        from operations.models import ActiveTrip, BoardingRequest, Vehicle
        from transport.models import City, Route, Stop, TripSchedule
        from common.constants import (
            TRIP_STATUS_ACTIVE,
            TRIP_STATUS_ARRIVED,
            TRIP_STATUS_COMPLETED,
            TRIP_STATUS_CANCELLED,
        )

        cutoff = timezone.now() - timedelta(days=days)

        # User stats
        total_users = User.objects.count()
        total_passengers = User.objects.filter(role="passenger").count()
        total_bike_drivers = User.objects.filter(role="bikedriver").count()
        total_auto_drivers = User.objects.filter(role="autodriver").count()
        new_users_period = User.objects.filter(
            date_joined__gte=cutoff
        ).count()

        # Route & infrastructure
        total_cities = City.objects.count()
        total_routes = Route.objects.count()
        total_stops = Stop.objects.count()
        total_schedules = TripSchedule.objects.count()

        # Trip stats
        all_trips_count = ActiveTrip.objects.count()
        total_trips = ActiveTrip.objects.filter(
            status=TRIP_STATUS_COMPLETED
        ).count()
        trips_period = ActiveTrip.objects.filter(
            status=TRIP_STATUS_COMPLETED, ended_at__gte=cutoff
        ).count()
        active_trips = ActiveTrip.objects.filter(
            status__in=[TRIP_STATUS_ACTIVE, TRIP_STATUS_ARRIVED]
        ).count()
        cancelled_trips = ActiveTrip.objects.filter(
            status=TRIP_STATUS_CANCELLED
        ).count()

        # Trip completion rate
        completion_rate = (
            round((total_trips / max(all_trips_count, 1)) * 100, 1)
            if all_trips_count > 0
            else 0
        )

        # Vehicle stats
        total_vehicles = Vehicle.objects.count()
        active_vehicles = Vehicle.objects.filter(is_active=True).count()

        # Boarding stats
        total_boardings = BoardingRequest.objects.count()
        boardings_period = BoardingRequest.objects.filter(
            created_at__gte=cutoff
        ).count()

        # Daily trip breakdown
        daily_trips = list(
            ActiveTrip.objects.filter(
                status=TRIP_STATUS_COMPLETED, ended_at__gte=cutoff
            )
            .extra(select={"day": "date(ended_at)"})
            .values("day")
            .annotate(trips=Count("id"))
            .order_by("day")
        )

        # Daily new users
        daily_users = list(
            User.objects.filter(date_joined__gte=cutoff)
            .extra(select={"day": "date(date_joined)"})
            .values("day")
            .annotate(users=Count("id"))
            .order_by("day")
        )

        # Trip status breakdown
        trip_status = list(
            ActiveTrip.objects.values("status")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # City performance: routes + schedules + trips + boardings per city
        city_performance = list(
            City.objects.annotate(
                route_count=Count("routes", distinct=True),
                schedule_count=Count("routes__schedules", distinct=True),
            )
            .order_by("-route_count")[:10]
            .values("name", "route_count", "schedule_count")
        )

        # Attach trip and boarding counts per city
        for city_data in city_performance:
            city_name = city_data["name"]
            city_obj = City.objects.filter(name=city_name).first()
            if city_obj:
                city_route_ids = city_obj.routes.values_list("id", flat=True)
                city_data["trips"] = ActiveTrip.objects.filter(
                    route_id__in=city_route_ids,
                    status=TRIP_STATUS_COMPLETED,
                ).count()
                city_data["boardings"] = BoardingRequest.objects.filter(
                    pickup_stop__route_id__in=city_route_ids,
                ).count()
            else:
                city_data["trips"] = 0
                city_data["boardings"] = 0

        return {
            "platform": "app",
            "summary": {
                "total_users": total_users,
                "total_passengers": total_passengers,
                "total_bike_drivers": total_bike_drivers,
                "total_auto_drivers": total_auto_drivers,
                "new_users_period": new_users_period,
                "total_cities": total_cities,
                "total_routes": total_routes,
                "total_stops": total_stops,
                "total_schedules": total_schedules,
                "total_trips": total_trips,
                "trips_period": trips_period,
                "active_trips": active_trips,
                "cancelled_trips": cancelled_trips,
                "completion_rate": completion_rate,
                "total_vehicles": total_vehicles,
                "active_vehicles": active_vehicles,
                "total_boardings": total_boardings,
                "boardings_period": boardings_period,
                "users_breakdown": {
                    "passengers": total_passengers,
                    "bike_drivers": total_bike_drivers,
                    "auto_drivers": total_auto_drivers,
                },
            },
            "daily_trips": daily_trips,
            "daily_users": daily_users,
            "trip_status": trip_status,
            "city_performance": city_performance,
            "period_days": days,
        }


# ─── 4. Historical Snapshots ────────────────────────────
class KPISnapshotAPI(APIView):
    """GET /api/kpi/snapshots/ — Historical KPI snapshots."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        days = int(request.query_params.get("days", 30))
        cutoff = timezone.now().date() - timedelta(days=days)
        snapshots = KPISnapshot.objects.filter(date__gte=cutoff)
        return Response(
            {
                "success": True,
                "data": KPISnapshotSerializer(snapshots, many=True).data,
            }
        )


# ─── 5. Geo Analytics ───────────────────────────────────
class GeoStatsAPI(APIView):
    """GET /api/kpi/geo-stats/?source={geoevent|pageview}&days={N}

    Unified geo-analytics endpoint returning country/city/region
    breakdowns, timezone distribution, and map point data.
    """

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        source = request.query_params.get("source", "geoevent")
        days = int(request.query_params.get("days", 30))

        if source == "pageview":
            data = self._pageview_stats(days)
        else:
            data = self._geoevent_stats(days)

        return Response({"success": True, "data": data})

    def _geoevent_stats(self, days: int) -> dict[str, Any]:
        from tracking.models import GeoEvent

        cutoff = timezone.now() - timedelta(days=days)
        qs = GeoEvent.objects.filter(created_at__gte=cutoff)
        total = qs.count()

        country_breakdown = list(
            qs.exclude(country="")
            .values("country", "country_code")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
        )
        for e in country_breakdown:
            e["percentage"] = round((e["count"] / max(total, 1)) * 100, 1)

        city_breakdown = list(
            qs.exclude(city="")
            .values("city", "country")
            .annotate(
                count=Count("id"),
                avg_lat=Avg("latitude"),
                avg_lng=Avg("longitude"),
            )
            .order_by("-count")[:30]
        )
        for e in city_breakdown:
            e["percentage"] = round((e["count"] / max(total, 1)) * 100, 1)
            e["avg_lat"] = round(e["avg_lat"], 4) if e["avg_lat"] else None
            e["avg_lng"] = round(e["avg_lng"], 4) if e["avg_lng"] else None

        region_breakdown = list(
            qs.exclude(region="")
            .values("region", "country")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
        )
        for e in region_breakdown:
            e["percentage"] = round((e["count"] / max(total, 1)) * 100, 1)

        timezone_distribution = list(
            qs.exclude(timezone="")
            .values("timezone")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
        )
        for e in timezone_distribution:
            e["percentage"] = round((e["count"] / max(total, 1)) * 100, 1)

        map_points = list(
            qs.exclude(latitude__isnull=True)
            .exclude(longitude__isnull=True)
            .values_list("latitude", "longitude")
        )
        map_points = [{"lat": lat, "lng": lng, "weight": 1} for lat, lng in map_points]

        daily_by_country = list(
            qs.exclude(country="")
            .extra(select={"day": "date(created_at)"})
            .values("day", "country")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        return {
            "source": "geoevent",
            "period_days": days,
            "total_events": total,
            "unique_countries": qs.exclude(country="").values("country").distinct().count(),
            "unique_cities": qs.exclude(city="").values("city").distinct().count(),
            "unique_regions": qs.exclude(region="").values("region").distinct().count(),
            "country_breakdown": country_breakdown,
            "city_breakdown": city_breakdown,
            "region_breakdown": region_breakdown,
            "timezone_distribution": timezone_distribution,
            "map_points": map_points,
            "daily_by_country": daily_by_country,
        }

    def _pageview_stats(self, days: int) -> dict[str, Any]:
        cutoff = timezone.now() - timedelta(days=days)
        qs = PageView.objects.filter(created_at__gte=cutoff)
        total = qs.count()

        country_breakdown = list(
            qs.exclude(country="")
            .values("country", "country_code")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
        )
        for e in country_breakdown:
            e["percentage"] = round((e["count"] / max(total, 1)) * 100, 1)

        city_breakdown = list(
            qs.exclude(city="")
            .values("city", "country")
            .annotate(
                count=Count("id"),
                avg_lat=Avg("latitude"),
                avg_lng=Avg("longitude"),
            )
            .order_by("-count")[:30]
        )
        for e in city_breakdown:
            e["percentage"] = round((e["count"] / max(total, 1)) * 100, 1)
            e["avg_lat"] = round(e["avg_lat"], 4) if e["avg_lat"] else None
            e["avg_lng"] = round(e["avg_lng"], 4) if e["avg_lng"] else None

        region_breakdown = list(
            qs.exclude(region="")
            .values("region", "country")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
        )
        for e in region_breakdown:
            e["percentage"] = round((e["count"] / max(total, 1)) * 100, 1)

        timezone_distribution = list(
            qs.exclude(timezone="")
            .values("timezone")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
        )
        for e in timezone_distribution:
            e["percentage"] = round((e["count"] / max(total, 1)) * 100, 1)

        map_points = list(
            qs.exclude(latitude__isnull=True)
            .exclude(longitude__isnull=True)
            .values_list("latitude", "longitude")
        )
        map_points = [{"lat": lat, "lng": lng, "weight": 1} for lat, lng in map_points]

        daily_by_country = list(
            qs.exclude(country="")
            .extra(select={"day": "date(created_at)"})
            .values("day", "country")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        return {
            "source": "pageview",
            "period_days": days,
            "total_events": total,
            "unique_countries": qs.exclude(country="").values("country").distinct().count(),
            "unique_cities": qs.exclude(city="").values("city").distinct().count(),
            "unique_regions": qs.exclude(region="").values("region").distinct().count(),
            "country_breakdown": country_breakdown,
            "city_breakdown": city_breakdown,
            "region_breakdown": region_breakdown,
            "timezone_distribution": timezone_distribution,
            "map_points": map_points,
            "daily_by_country": daily_by_country,
        }
