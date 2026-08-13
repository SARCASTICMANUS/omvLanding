export const USER_ROLES = {
  driver: "driver",
  bikedriver: "bikedriver",
  autodriver: "autodriver",
  passenger: "passenger",
  admin: "admin",
};

export const ADMIN_ROLES = [
  USER_ROLES.admin,
];

export const PASSENGER_ROLES = [USER_ROLES.passenger];

export const DRIVER_ROLES = [USER_ROLES.driver, USER_ROLES.bikedriver, USER_ROLES.autodriver];

