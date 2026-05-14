export const USER_ROLES = {
  driver: "driver",
  passenger: "passenger",
  student: "student",
  admin: "admin",
  cityAdmin: "city_admin",
  universityAdmin: "university_admin",
  superAdmin: "super_admin",
};

export const ADMIN_ROLES = [
  USER_ROLES.admin,
  USER_ROLES.cityAdmin,
  USER_ROLES.universityAdmin,
  USER_ROLES.superAdmin,
];

export const PASSENGER_ROLES = [USER_ROLES.passenger, USER_ROLES.student];

