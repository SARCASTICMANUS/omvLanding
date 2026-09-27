import React from "react";
import { Navigate } from "react-router-dom";
import { APP_ROUTES } from "../constants/routes";
import { PASSENGER_ROLES, DRIVER_ROLES } from "../constants/roles";
import AppLayout from "../layouts/AppLayout";
import AdminPanel from "../pages/AdminPanel";
import DriverLivePage from "../pages/DriverLivePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import PasswordResetPage from "../pages/PasswordResetPage";
import PassengerLivePage from "../pages/PassengerLivePage";
import DriverProfileUpdate from "../pages/DriverProfileUpdate";

import PassengerProfileUpdate from "../pages/PassengerProfileUpdate";
import ProfilePage from "../pages/ProfilePage";
import AboutPage from "../pages/AboutPage";
import NotificationsPage from "../pages/NotificationsPage";
import ContactUsPage from "../pages/ContactUsPage";
import HelpSupportPage from "../pages/HelpSupportPage";
import PrivacyPolicyPage from "../pages/PrivacyPolicyPage";
import TermsPage from "../pages/TermsPage";
import RoutesPage from "../pages/RoutesPage";
import HomeOrLanding from "../pages/HomeOrLanding";
import TripsPage from "../pages/TripsPage";

import TrackingPage from "../pages/TrackingPage";
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
    path: APP_ROUTES.forgotPassword,
    element: (
      <PublicRoute>
        <PasswordResetPage />
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
      <ProtectedRoute allowedRoles={DRIVER_ROLES}>
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
    path: APP_ROUTES.tracking,
    element: (
      <ProtectedRoute allowedRoles={PASSENGER_ROLES}>
        <AppLayout>
          <TrackingPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: APP_ROUTES.driverProfileUpdate,
    element: (
      <ProtectedRoute allowedRoles={DRIVER_ROLES}>
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
    path: APP_ROUTES.profile,
    element: (
      <ProtectedRoute allowedRoles={[...PASSENGER_ROLES, ...DRIVER_ROLES]}>
        <AppLayout>
          <ProfilePage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: APP_ROUTES.trips,
    element: (
      <ProtectedRoute allowedRoles={[...PASSENGER_ROLES, ...DRIVER_ROLES]}>
        <AppLayout>
          <TripsPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: APP_ROUTES.notifications,
    element: (
      <ProtectedRoute allowedRoles={[...PASSENGER_ROLES, ...DRIVER_ROLES]}>
        <AppLayout>
          <NotificationsPage />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: APP_ROUTES.root,
    element: (
      <AppLayout flush={false}>
        <HomeOrLanding />
      </AppLayout>
    ),
  },
  { path: APP_ROUTES.about, element: <AppLayout><AboutPage /></AppLayout> },
  { path: APP_ROUTES.contact, element: <AppLayout><ContactUsPage /></AppLayout> },
  { path: APP_ROUTES.help, element: <AppLayout><HelpSupportPage /></AppLayout> },
  { path: APP_ROUTES.privacy, element: <AppLayout><PrivacyPolicyPage /></AppLayout> },
  { path: APP_ROUTES.terms, element: <AppLayout><TermsPage /></AppLayout> },
  { path: APP_ROUTES.routes, element: <AppLayout><RoutesPage /></AppLayout> },
  { path: "*", element: <Navigate to={APP_ROUTES.root} replace /> },
];
