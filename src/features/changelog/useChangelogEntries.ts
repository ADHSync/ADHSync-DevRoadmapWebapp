import { useCallback, useEffect, useRef, useState } from "react";

import { databaseErrorMessage } from "../../lib/database-error";
import { supabase } from "../../lib/supabase";
import type {
  ChangelogEntry,
  ChangelogEntryInsert,
  ChangelogEntryUpdate,
} from "../../types/database";

function optimisticChangelogEntry(
  payload: ChangelogEntryInsert,
): ChangelogEntry {
  const now = new Date().toISOString();

  return {
    id: `optimistic-${crypto.randomUUID()}`,
    app_version: payload.app_version,
    released_on: payload.released_on,
    change_kind: payload.change_kind ?? "changed",
    title_de: payload.title_de,
    body_de: payload.body_de,
    title_en: payload.title_en ?? null,
    body_en: payload.body_en ?? null,
    visibility: payload.visibility ?? "public",
    roadmap_item_id: payload.roadmap_item_id ?? null,
    sort_order: payload.sort_order ?? 0,
    translation_status: payload.translation_status ?? "missing",
    source_hash: payload.source_hash ?? null,
    created_at: payload.created_at ?? now,
    updated_at: payload.updated_at ?? now,
  };
}

export function useChangelogEntries() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const entriesRef = useRef<ChangelogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const replaceEntries = useCallback((nextEntries: ChangelogEntry[]) => {
    entriesRef.current = nextEntries;
    setEntries(nextEntries);
  }, []);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from("changelog_entries")
      .select("*")
      .order("released_on", { ascending: false })
      .order("sort_order");

    if (error) {
      setLoadError(databaseErrorMessage(error));
      setIsLoading(false);
      return;
    }

    replaceEntries(data);
    setIsLoading(false);
  }, [replaceEntries]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const createEntry = useCallback(
    async (payload: ChangelogEntryInsert) => {
      const previousEntries = entriesRef.current;
      const optimisticEntry = optimisticChangelogEntry(payload);
      replaceEntries([...previousEntries, optimisticEntry]);
      setIsMutating(true);

      try {
        const { data, error } = await supabase
          .from("changelog_entries")
          .insert(payload)
          .select()
          .single();

        if (error) {
          throw error;
        }

        replaceEntries(
          entriesRef.current.map((entry) =>
            entry.id === optimisticEntry.id ? data : entry,
          ),
        );
        return data;
      } catch (error) {
        replaceEntries(previousEntries);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [replaceEntries],
  );

  const createEntries = useCallback(
    async (payloads: ChangelogEntryInsert[]) => {
      if (payloads.length === 0) {
        return [];
      }

      const previousEntries = entriesRef.current;
      const optimisticEntries = payloads.map(optimisticChangelogEntry);
      const optimisticIds = new Set(optimisticEntries.map((entry) => entry.id));
      replaceEntries([...previousEntries, ...optimisticEntries]);
      setIsMutating(true);

      try {
        const { data, error } = await supabase
          .from("changelog_entries")
          .insert(payloads)
          .select();

        if (error) {
          throw error;
        }

        replaceEntries([
          ...entriesRef.current.filter((entry) => !optimisticIds.has(entry.id)),
          ...data,
        ]);
        return data;
      } catch (error) {
        replaceEntries(previousEntries);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [replaceEntries],
  );

  const updateEntry = useCallback(
    async (id: string, payload: ChangelogEntryUpdate) => {
      const previousEntries = entriesRef.current;
      replaceEntries(
        previousEntries.map((entry) =>
          entry.id === id
            ? { ...entry, ...payload, updated_at: new Date().toISOString() }
            : entry,
        ),
      );
      setIsMutating(true);

      try {
        const { data, error } = await supabase
          .from("changelog_entries")
          .update(payload)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        replaceEntries(
          entriesRef.current.map((entry) => (entry.id === id ? data : entry)),
        );
        return data;
      } catch (error) {
        replaceEntries(previousEntries);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [replaceEntries],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const previousEntries = entriesRef.current;
      replaceEntries(previousEntries.filter((entry) => entry.id !== id));
      setIsMutating(true);

      try {
        const { error } = await supabase
          .from("changelog_entries")
          .delete()
          .eq("id", id);

        if (error) {
          throw error;
        }
      } catch (error) {
        replaceEntries(previousEntries);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [replaceEntries],
  );

  const applyRemoteUpdate = useCallback(
    (id: string, payload: ChangelogEntryUpdate) => {
      replaceEntries(
        entriesRef.current.map((entry) =>
          entry.id === id
            ? { ...entry, ...payload, updated_at: new Date().toISOString() }
            : entry,
        ),
      );
    },
    [replaceEntries],
  );

  return {
    entries,
    isLoading,
    isMutating,
    loadError,
    reload: loadEntries,
    createEntry,
    createEntries,
    updateEntry,
    applyRemoteUpdate,
    deleteEntry,
  };
}
