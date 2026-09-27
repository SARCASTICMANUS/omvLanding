export const APP_ROUTES = {
  root: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  admin: "/admin",
  driverLive: "/driver/live",
  passengerLive: "/passenger/live",
  driverProfileUpdate: "/driver/profile/update",
  
  passengerProfileUpdate: "/passenger/profile/update",
  profile: "/profile",
  trips: "/trips",
  notifications: "/notifications",
  about: "/about",
  contact: "/contact",
  help: "/help",
  privacy: "/privacy",
  terms: "/terms",
  routes: "/routes",
  tracking: "/passenger/tracking/:tripId",
};

export const ROLE_ROUTES = {
  driver: APP_ROUTES.driverLive,
  bikedriver: APP_ROUTES.driverLive,
  autodriver: APP_ROUTES.driverLive,
  admin: APP_ROUTES.admin,
  passenger: APP_ROUTES.root,
};
