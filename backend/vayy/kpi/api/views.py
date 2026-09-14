import logging
import uuid
import hashlib
from datetime import timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.db.models import Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from kpi.models import PageView, KPISnapshot
from kpi.api.serializers import PageViewSerializer, KPISnapshotSerializer

logger = logging.getLogger(__name__)

VISITOR_COOKIE = "vayy_vid"
VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60  # 1 year


class TrackPageViewAPI(APIView):
    """POST /api/kpi/track/ — Record a page view (web or app)."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PageViewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        if not ip:
            ip = request.META.get("REMOTE_ADDR", "")

        visitor_id = request.COOKIES.get(VISITOR_COOKIE)
        if not visitor_id:
            fingerprint = f"{ip}-{request.META.get('HTTP_USER_AGENT', '')}"
            visitor_id = hashlib.sha256(fingerprint.encode()).hexdigest()[:32]

        serializer.save(ip_address=ip, visitor_id=visitor_id)

        response = JsonResponse({"success": True, "message": "Page view recorded"})
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


class KPIOverviewAPI(APIView):
    """
    GET /api/kpi/overview/?platform=web&days=30

    platform=web  → Landing page metrics (visits, waitlist, top pages, bounce)
    platform=app  → Transit app metrics (users, trips, routes, drivers, active vehicles)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        platform = request.query_params.get("platform", "web")
        days = int(request.query_params.get("days", 30))
        cutoff = timezone.now() - timedelta(days=days)

        if platform == "web":
            data = self._web_metrics(cutoff, days)
        else:
            data = self._app_metrics(cutoff, days)

        return Response({"success": True, "data": data})

    def _web_metrics(self, cutoff, days):
        """Landing page / website KPIs."""
        qs = PageView.objects.filter(platform="web", created_at__gte=cutoff)

        total_visits = qs.count()
        unique_visitors = qs.values("visitor_id").distinct().count()

        # Daily breakdown
        daily = list(
            qs.extra(select={"day": "date(created_at)"})
            .values("day")
            .annotate(views=Count("id"), visitors=Count("visitor_id", distinct=True))
            .order_by("day")
        )

        # Top pages
        top_pages = list(
            qs.values("page")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )

        # Device breakdown
        device_stats = list(
            qs.exclude(device_type="")
            .values("device_type")
            .annotate(views=Count("id"))
            .order_by("-views")[:5]
        )

        # Referrer breakdown
        referrer_stats = list(
            qs.exclude(referrer="")
            .values("referrer")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )

        # Country breakdown
        country_stats = list(
            qs.exclude(country="")
            .values("country")
            .annotate(views=Count("id"))
            .order_by("-views")[:10]
        )

        # Bounce rate: single-page sessions (visitor_id with only 1 view)
        visitor_views = qs.values("visitor_id").annotate(view_count=Count("id"))
        single_page = visitor_views.filter(view_count=1).count()
        bounce_rate = round((single_page / max(unique_visitors, 1)) * 100, 1)

        # Avg views per visitor
        avg_views = round(total_visits / max(unique_visitors, 1), 1)

        return {
            "platform": "web",
            "summary": {
                "total_visits": total_visits,
                "unique_visitors": unique_visitors,
                "bounce_rate": bounce_rate,
                "avg_views_per_visitor": avg_views,
            },
            "daily": daily,
            "top_pages": top_pages,
            "device_stats": device_stats,
            "referrer_stats": referrer_stats,
            "country_stats": country_stats,
            "period_days": days,
        }

    def _app_metrics(self, cutoff, days):
        """Mobile app transit KPIs."""
        from accounts.models import User
        from transport.models import City, Route, Stop, TripSchedule
        from operations.models import ActiveTrip, Vehicle, BoardingRequest

        # User stats
        total_users = User.objects.count()
        total_passengers = User.objects.filter(role="passenger").count()
        total_bike_drivers = User.objects.filter(role="bikedriver").count()
        total_auto_drivers = User.objects.filter(role="autodriver").count()
        new_users_period = User.objects.filter(date_joined__gte=cutoff).count()

        # Route & infrastructure
        total_cities = City.objects.count()
        total_routes = Route.objects.count()
        total_stops = Stop.objects.count()
        total_schedules = TripSchedule.objects.count()

        # Trip stats
        total_trips = ActiveTrip.objects.filter(status="completed").count()
        trips_period = ActiveTrip.objects.filter(status="completed", ended_at__gte=cutoff).count()
        active_trips = ActiveTrip.objects.filter(status__in=["active", "arrived"]).count()

        # Vehicle stats
        total_vehicles = Vehicle.objects.count()
        active_vehicles = Vehicle.objects.filter(status="active").count()

        # Boarding stats
        total_boardings = BoardingRequest.objects.count()
        boardings_period = BoardingRequest.objects.filter(created_at__gte=cutoff).count()

        # Daily trip breakdown
        daily_trips = list(
            ActiveTrip.objects.filter(status="completed", ended_at__gte=cutoff)
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

        # City with most routes
        city_routes = list(
            City.objects.annotate(route_count=Count("routes"))
            .order_by("-route_count")[:5]
            .values("name", "route_count")
        )

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
                "total_vehicles": total_vehicles,
                "active_vehicles": active_vehicles,
                "total_boardings": total_boardings,
                "boardings_period": boardings_period,
            },
            "daily_trips": daily_trips,
            "daily_users": daily_users,
            "trip_status": trip_status,
            "city_routes": city_routes,
            "period_days": days,
        }


class KPISnapshotAPI(APIView):
    """GET /api/kpi/snapshots/ — Historical KPI snapshots."""
    permission_classes = [AllowAny]

    def get(self, request):
        days = int(request.query_params.get("days", 30))
        cutoff = timezone.now().date() - timedelta(days=days)
        snapshots = KPISnapshot.objects.filter(date__gte=cutoff)
        return Response({
            "success": True,
            "data": KPISnapshotSerializer(snapshots, many=True).data,
        })
