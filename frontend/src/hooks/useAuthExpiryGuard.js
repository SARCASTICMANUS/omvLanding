import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { jwtDecode } from "jwt-decode";

import { logout } from "../features/auth/authSlice";

export function useAuthExpiryGuard() {
  const dispatch = useDispatch();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");

    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;

      if (decoded?.exp && decoded.exp < now && !refreshToken) {
        localStorage.clear();
        sessionStorage.clear();
        dispatch(logout());
      }
    } catch {
      localStorage.clear();
      sessionStorage.clear();
      dispatch(logout());
    }
  }, [dispatch]);
}
