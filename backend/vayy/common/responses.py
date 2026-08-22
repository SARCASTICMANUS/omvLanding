from rest_framework.response import Response
from typing import Any, Optional

def success_response(data: Any = None, message: str = "Operation successful", status_code: int = 200) -> Response:
    """
    Standardized success response.
    """
    return Response({
        "success": True,
        "message": message,
        "data": data or {}
    }, status=status_code)

def error_response(message: str = "Operation failed", data: Any = None, status_code: int = 400) -> Response:
    """
    Standardized error response.
    """
    return Response({
        "success": False,
        "message": message,
        "data": data or {}
    }, status=status_code)
