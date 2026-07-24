import { useCallback, useEffect, useRef, useState } from "react";

import { databaseErrorMessage } from "../../lib/database-error";
import { supabase } from "../../lib/supabase";
import type {
  ContentHorizon,
  RoadmapItem,
  RoadmapItemInsert,
  RoadmapItemUpdate,
} from "../../types/database";

function optimisticRoadmapItem(payload: RoadmapItemInsert): RoadmapItem {
  const now = new Date().toISOString();

  return {
    id: `optimistic-${crypto.randomUUID()}`,
    slug: payload.slug,
    title_de: payload.title_de,
    summary_de: payload.summary_de,
    title_en: payload.title_en ?? null,
    summary_en: payload.summary_en ?? null,
    dev_notes: payload.dev_notes ?? null,
    status: payload.status ?? "planned",
    visibility: payload.visibility ?? "public",
    horizon: payload.horizon ?? "mid",
    priority: payload.priority ?? "normal",
    category: payload.category ?? null,
    sort_order: payload.sort_order ?? 0,
    completed_at: payload.completed_at ?? null,
    translation_status: payload.translation_status ?? "missing",
    source_hash: payload.source_hash ?? null,
    created_at: payload.created_at ?? now,
    updated_at: payload.updated_at ?? now,
  };
}

export function useRoadmapItems() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const itemsRef = useRef<RoadmapItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const replaceItems = useCallback((nextItems: RoadmapItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from("roadmap_items")
      .select("*")
      .order("horizon")
      .order("sort_order")
      .order("updated_at", { ascending: false });

    if (error) {
      setLoadError(databaseErrorMessage(error));
      setIsLoading(false);
      return;
    }

    replaceItems(data);
    setIsLoading(false);
  }, [replaceItems]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const createItem = useCallback(
    async (payload: RoadmapItemInsert) => {
      const previousItems = itemsRef.current;
      const optimisticItem = optimisticRoadmapItem(payload);
      replaceItems([...previousItems, optimisticItem]);
      setIsMutating(true);

      try {
        const { data, error } = await supabase
          .from("roadmap_items")
          .insert(payload)
          .select()
          .single();

        if (error) {
          throw error;
        }

        replaceItems(
          itemsRef.current.map((item) =>
            item.id === optimisticItem.id ? data : item,
          ),
        );
        return data;
      } catch (error) {
        replaceItems(previousItems);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [replaceItems],
  );

  const updateItem = useCallback(
    async (id: string, payload: RoadmapItemUpdate) => {
      const previousItems = itemsRef.current;
      const optimisticUpdatedAt = new Date().toISOString();
      replaceItems(
        previousItems.map((item) =>
          item.id === id
            ? { ...item, ...payload, updated_at: optimisticUpdatedAt }
            : item,
        ),
      );
      setIsMutating(true);

      try {
        const { data, error } = await supabase
          .from("roadmap_items")
          .update(payload)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        replaceItems(
          itemsRef.current.map((item) => (item.id === id ? data : item)),
        );
        return data;
      } catch (error) {
        replaceItems(previousItems);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [replaceItems],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const previousItems = itemsRef.current;
      replaceItems(previousItems.filter((item) => item.id !== id));
      setIsMutating(true);

      try {
        const { error } = await supabase
          .from("roadmap_items")
          .delete()
          .eq("id", id);

        if (error) {
          throw error;
        }
      } catch (error) {
        replaceItems(previousItems);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [replaceItems],
  );

  const applyRemoteUpdate = useCallback(
    (id: string, payload: RoadmapItemUpdate) => {
      replaceItems(
        itemsRef.current.map((item) =>
          item.id === id
            ? { ...item, ...payload, updated_at: new Date().toISOString() }
            : item,
        ),
      );
    },
    [replaceItems],
  );

  const reorderWithinHorizon = useCallback(
    async (horizon: ContentHorizon, reorderedItems: RoadmapItem[]) => {
      const previousItems = itemsRef.current;
      const orderById = new Map(
        reorderedItems.map((item, index) => [item.id, (index + 1) * 10]),
      );
      const optimisticItems = previousItems.map((item) =>
        item.horizon === horizon
          ? { ...item, sort_order: orderById.get(item.id) ?? item.sort_order }
          : item,
      );

      replaceItems(optimisticItems);
      setIsMutating(true);

      try {
        await Promise.all(
          reorderedItems.map(async (item, index) => {
            const { error } = await supabase
              .from("roadmap_items")
              .update({ sort_order: (index + 1) * 10 })
              .eq("id", item.id);

            if (error) {
              throw error;
            }
          }),
        );
      } catch (error) {
        replaceItems(previousItems);
        void loadItems();
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [loadItems, replaceItems],
  );

  return {
    items,
    isLoading,
    isMutating,
    loadError,
    reload: loadItems,
    createItem,
    updateItem,
    applyRemoteUpdate,
    deleteItem,
    reorderWithinHorizon,
  };
}
