import api from "./client";
import { API_PATHS } from "../../constants/apiPaths";

export const routeService = {
  previewRoute: ({ start, end, stops }) =>
    api.post(API_PATHS.admin.routePreview, { start, end, stops }),
};

