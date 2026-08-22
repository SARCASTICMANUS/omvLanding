from transport.models import Route


class RouteService:

    @staticmethod
    def get_route(route_id):
        return Route.objects.select_related(
            "city"
        ).prefetch_related(
            "stops",
            "schedules"
        ).get(
            id=route_id
        )

    @staticmethod
    def list_city_routes(city_id):
        return Route.objects.filter(
            city_id=city_id
        )

    @staticmethod
    def recalculate_route_distance(route_id):
        """
        Uses OSRM to calculate the real road distance and path for a route based on its stops.
        Updates the Route object's total_distance_meters and path fields.
        """
        from transport.models import Route
        from transport.services.osrm_service import OSRMService
        from django.contrib.gis.geos import LineString
        
        route = Route.objects.prefetch_related("stops").get(id=route_id)
        stops = route.stops.all().order_by("order")
        
        if stops.count() < 2:
            return 0
            
        coords = [(stop.location.x, stop.location.y) for stop in stops]
        osrm_data = OSRMService.route(*coords)
        
        if osrm_data and osrm_data.get("routes"):
            osrm_route = osrm_data["routes"][0]
            route.total_distance_meters = osrm_route["distance"]
            
            # Update path if geometry is returned
            if "geometry" in osrm_route:
                geom = osrm_route["geometry"]
                if geom["type"] == "LineString":
                    route.path = LineString(geom["coordinates"], srid=4326)
            
            route.save()
            return route.total_distance_meters
            
        return 0