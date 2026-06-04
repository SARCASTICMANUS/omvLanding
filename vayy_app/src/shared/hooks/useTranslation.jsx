import useLanguage from "./useLanguage";

export default function useTranslation() {
  const { t } = useLanguage();

  return { t };
}
