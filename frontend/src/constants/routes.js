export const APP_ROUTES = {
  root: "/",
  login: "/login",
  register: "/register",
  admin: "/admin",
  driverLive: "/driver/live",
  passengerLive: "/passenger/live",
  driverProfileUpdate: "/driver/profile/update",
  passengerProfileUpdate: "/passenger/profile/update",
  profile: "/profile",
  about: "/about",
  contact: "/contact",
  routes: "/routes",
  allBuses: "/passenger/all-buses",
  tracking: "/passenger/tracking/:tripId",
  splash2: "/splash2",
  splash3: "/splash3",
  splash4: "/splash4",
};

export const ROLE_ROUTES = {
  driver: APP_ROUTES.driverLive,
  bikedriver: APP_ROUTES.driverLive,
  autodriver: APP_ROUTES.driverLive,
  admin: APP_ROUTES.admin,
  passenger: APP_ROUTES.passengerLive,
};
