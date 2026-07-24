import { useEffect, useState } from "react";

import { isTranslationStale, type TranslationSourceRow } from "./translation";

type HashableItem = TranslationSourceRow & {
  id: string;
};

export function useStaleTranslations<T extends HashableItem>(
  items: T[],
): ReadonlySet<string> {
  const [staleIds, setStaleIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let active = true;

    void Promise.all(
      items.map(async (item) => ({
        id: item.id,
        isStale: await isTranslationStale(item),
      })),
    ).then((results) => {
      if (active) {
        setStaleIds(
          new Set(
            results
              .filter((result) => result.isStale)
              .map((result) => result.id),
          ),
        );
      }
    });

    return () => {
      active = false;
    };
  }, [items]);

  return staleIds;
}
