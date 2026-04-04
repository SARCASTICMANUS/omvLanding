import os
import platform

if platform.system() == "Darwin":
    os.environ["GDAL_LIBRARY_PATH"] = "/opt/homebrew/opt/gdal/lib/libgdal.dylib"
    os.environ["GEOS_LIBRARY_PATH"] = "/opt/homebrew/opt/geos/lib/libgeos_c.dylib"

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vayy.settings")
django.setup()

from django.contrib.gis.geos import Point
from core.models import Route

def inspect_route(route_id):
    r = Route.objects.get(id=route_id)
    print(f"Route: {r.name}")
    print(f"Path points (first 5): {r.path.coords[:5]}")
    print(f"Path points (last 5): {r.path.coords[-5:]}")
    print(f"Total points: {len(r.path.coords)}")
    
    # Check if Kharar (30.7488, 76.6428) is anywhere in the path
    kharar = Point(76.6428, 30.7488, srid=4326)
    dist = r.path.distance(kharar)
    print(f"Distance to Kharar: {dist} degrees")
    
    mohali = Point(76.7176, 30.7041, srid=4326)
    dist_m = r.path.distance(mohali)
    print(f"Distance to Mohali: {dist_m} degrees")

if __name__ == "__main__":
    inspect_route("b40682f2-beac-4769-92dd-f65be7da9666")
