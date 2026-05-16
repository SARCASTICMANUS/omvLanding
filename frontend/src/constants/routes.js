export const APP_ROUTES = {
  root: "/",
  login: "/login",
  register: "/register",
  admin: "/admin",
  driverLive: "/driver/live",
  passengerLive: "/passenger/live",
  driverProfileUpdate: "/driver/profile/update",
  passengerProfileUpdate: "/passenger/profile/update",
  about: "/about",
  contact: "/contact",
  routes: "/routes",
  splash2: "/splash2",
  splash3: "/splash3",
  splash4: "/splash4",
};

export const ROLE_ROUTES = {
  driver: APP_ROUTES.driverLive,
  admin: APP_ROUTES.admin,
  city_admin: APP_ROUTES.admin,
  university_admin: APP_ROUTES.admin,
  super_admin: APP_ROUTES.admin,
  passenger: APP_ROUTES.passengerLive,
  student: APP_ROUTES.passengerLive,
};
