import React from "react";
import { Navigate } from "react-router-dom";
import { APP_ROUTES } from "../constants/routes";
import { PASSENGER_ROLES, USER_ROLES } from "../constants/roles";
import AppLayout from "../layouts/AppLayout";
import AdminPanel from "../pages/AdminPanel";
import DriverLivePage from "../pages/DriverLivePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import PassengerLivePage from "../pages/PassengerLivePage";
import DriverProfileUpdate from "../pages/DriverProfileUpdate";
import PassengerProfileUpdate from "../pages/PassengerProfileUpdate";
import AboutPage from "../pages/AboutPage";
import ContactUsPage from "../pages/ContactUsPage";
import RoutesPage from "../pages/RoutesPage";
import {
  SplashScreen1 as IntroPage,
  SplashScreen2,
  SplashScreen3,
  SplashScreen4,
} from "../components/onboarding";
import { ProtectedAdmin, ProtectedRoute, PublicRoute } from "./guards";

export const appRouteConfig = [
  {
    path: APP_ROUTES.login,
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: APP_ROUTES.register,
    element: (
      <PublicRoute>
        <RegisterPage />
      </PublicRoute>
    ),
  },
  {
    path: APP_ROUTES.admin,
    element: (
      <ProtectedAdmin>
        <AppLayout showNavbar={false}>
          <AdminPanel />
        </AppLayout>
      </ProtectedAdmin>
    ),
  },
  {
    path: APP_ROUTES.driverLive,
    element: (
      <ProtectedRoute allowedRoles={[USER_ROLES.driver]}>
        <AppLayout>
          <DriverLivePage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: APP_ROUTES.passengerLive,
    element: (
      <ProtectedRoute allowedRoles={PASSENGER_ROLES}>
        <AppLayout>
          <PassengerLivePage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: APP_ROUTES.driverProfileUpdate,
    element: (
      <ProtectedRoute allowedRoles={[USER_ROLES.driver]}>
        <AppLayout>
          <DriverProfileUpdate />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: APP_ROUTES.passengerProfileUpdate,
    element: (
      <ProtectedRoute allowedRoles={PASSENGER_ROLES}>
        <AppLayout>
          <PassengerProfileUpdate />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: APP_ROUTES.root,
    element: (
      <PublicRoute>
        <AppLayout>
          <IntroPage />
        </AppLayout>
      </PublicRoute>
    ),
  },
  {
    path: APP_ROUTES.splash2,
    element: (
      <PublicRoute>
        <AppLayout>
          <SplashScreen2 />
        </AppLayout>
      </PublicRoute>
    ),
  },
  {
    path: APP_ROUTES.splash3,
    element: (
      <PublicRoute>
        <AppLayout>
          <SplashScreen3 />
        </AppLayout>
      </PublicRoute>
    ),
  },
  {
    path: APP_ROUTES.splash4,
    element: (
      <PublicRoute>
        <AppLayout>
          <SplashScreen4 />
        </AppLayout>
      </PublicRoute>
    ),
  },
  { path: APP_ROUTES.about, element: <AppLayout><AboutPage /></AppLayout> },
  { path: APP_ROUTES.contact, element: <AppLayout><ContactUsPage /></AppLayout> },
  { path: APP_ROUTES.routes, element: <AppLayout><RoutesPage /></AppLayout> },
  { path: "*", element: <Navigate to={APP_ROUTES.root} replace /> },
];
