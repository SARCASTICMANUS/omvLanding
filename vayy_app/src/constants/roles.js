export const ROLE = {
  PASSENGER: "passenger",
  STUDENT: "student",
  BIKE_DRIVER: "bikedriver",
  AUTO_DRIVER: "autodriver",
  DRIVER: "driver",
  ADMIN: "admin",
};

export const PASSENGER_ROLES = [ROLE.PASSENGER, ROLE.STUDENT];
export const DRIVER_ROLES = [ROLE.BIKE_DRIVER, ROLE.AUTO_DRIVER, ROLE.DRIVER];
export const ALL_ROLES = [...PASSENGER_ROLES, ...DRIVER_ROLES, ROLE.ADMIN];

export const isDriverRole = (role) => DRIVER_ROLES.includes(role);
export const isPassengerRole = (role) => PASSENGER_ROLES.includes(role);
