export const ROLE = {
  PASSENGER: "passenger",
  BIKE_DRIVER: "bikedriver",
  AUTO_DRIVER: "autodriver",
  ADMIN: "admin",
};

export const PASSENGER_ROLES = [ROLE.PASSENGER];
export const DRIVER_ROLES = [ROLE.BIKE_DRIVER, ROLE.AUTO_DRIVER];
export const ALL_ROLES = [...PASSENGER_ROLES, ...DRIVER_ROLES, ROLE.ADMIN];

export const isDriverRole = (role) => DRIVER_ROLES.includes(role);
export const isPassengerRole = (role) => PASSENGER_ROLES.includes(role);
