import { useContext } from "react";

import { LanguageContext } from "../lib/i18n/LanguageContext";

export default function useLanguage() {
  return useContext(LanguageContext);
}
