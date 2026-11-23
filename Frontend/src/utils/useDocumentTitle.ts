import { useEffect } from "react";

export function useDocumentTitle(title: string, prefix = "PocketCircle") {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${prefix}` : prefix;
    document.title = fullTitle;
  }, [title, prefix]);
}
