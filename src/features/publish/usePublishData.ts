import { useCallback, useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";
import { isTranslationStale } from "../../lib/translation";
import type { Publication } from "../../types/database";
import type {
  ChangelogExportRow,
  RoadmapExportRow,
} from "../../../supabase/functions/publish/build-export";

type ContentType = "roadmap" | "changelog";

export interface RoadmapPublishRow extends RoadmapExportRow {
  id: string;
}

export interface ChangelogPublishRow extends Omit<
  ChangelogExportRow,
  "roadmap_slug"
> {
  roadmap_item_id: string | null;
}

export type PublicationSummary = Omit<Publication, "payload">;

interface LatestPublications {
  roadmap: PublicationSummary | null;
  changelog: PublicationSummary | null;
}

const emptyLatestPublications: LatestPublications = {
  roadmap: null,
  changelog: null,
};

function roadmapNeedsReview(item: RoadmapPublishRow): boolean {
  return (
    item.translation_status !== "reviewed" ||
    !item.title_en?.trim() ||
    !item.summary_en?.trim()
  );
}

function changelogNeedsReview(entry: ChangelogPublishRow): boolean {
  return (
    entry.translation_status !== "reviewed" ||
    !entry.title_en?.trim() ||
    !entry.body_en?.trim()
  );
}

export function usePublishData() {
  const [roadmapItems, setRoadmapItems] = useState<RoadmapPublishRow[]>([]);
  const [changelogEntries, setChangelogEntries] = useState<
    ChangelogPublishRow[]
  >([]);
  const [history, setHistory] = useState<PublicationSummary[]>([]);
  const [latestSuccessful, setLatestSuccessful] = useState<LatestPublications>(
    emptyLatestPublications,
  );
  const [latestAttempt, setLatestAttempt] = useState<LatestPublications>(
    emptyLatestPublications,
  );
  const [reviewWarnings, setReviewWarnings] = useState<
    Record<ContentType, number>
  >({
    roadmap: 0,
    changelog: 0,
  });
  const [staleWarnings, setStaleWarnings] = useState<
    Record<ContentType, number>
  >({
    roadmap: 0,
    changelog: 0,
  });
  const [previewGeneratedAt, setPreviewGeneratedAt] = useState(
    new Date().toISOString(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const [
      roadmapResult,
      changelogResult,
      historyResult,
      latestRoadmapSuccessResult,
      latestChangelogSuccessResult,
      latestRoadmapAttemptResult,
      latestChangelogAttemptResult,
    ] = await Promise.all([
      supabase
        .from("roadmap_items")
        .select(
          "id,slug,status,horizon,category,sort_order,completed_at,title_de,summary_de,title_en,summary_en,visibility,translation_status,source_hash",
        ),
      supabase
        .from("changelog_entries")
        .select(
          "id,app_version,released_on,change_kind,sort_order,roadmap_item_id,title_de,body_de,title_en,body_en,visibility,translation_status,source_hash",
        ),
      supabase
        .from("publications")
        .select(
          "id,content_type,version,version_label,item_count,status,error_message,published_by,published_at",
        )
        .order("published_at", { ascending: false })
        .limit(20),
      supabase
        .from("publications")
        .select(
          "id,content_type,version,version_label,item_count,status,error_message,published_by,published_at",
        )
        .eq("content_type", "roadmap")
        .eq("status", "success")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("publications")
        .select(
          "id,content_type,version,version_label,item_count,status,error_message,published_by,published_at",
        )
        .eq("content_type", "changelog")
        .eq("status", "success")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("publications")
        .select(
          "id,content_type,version,version_label,item_count,status,error_message,published_by,published_at",
        )
        .eq("content_type", "roadmap")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("publications")
        .select(
          "id,content_type,version,version_label,item_count,status,error_message,published_by,published_at",
        )
        .eq("content_type", "changelog")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const error =
      roadmapResult.error ??
      changelogResult.error ??
      historyResult.error ??
      latestRoadmapSuccessResult.error ??
      latestChangelogSuccessResult.error ??
      latestRoadmapAttemptResult.error ??
      latestChangelogAttemptResult.error;

    if (error) {
      setLoadError(error.message);
      setIsLoading(false);
      return;
    }

    const nextRoadmapItems = roadmapResult.data ?? [];
    const nextChangelogEntries = changelogResult.data ?? [];
    const publicRoadmapItems = nextRoadmapItems.filter(
      (item) => item.visibility === "public",
    );
    const publicChangelogEntries = nextChangelogEntries.filter(
      (entry) => entry.visibility === "public",
    );
    const [roadmapStaleStates, changelogStaleStates] = await Promise.all([
      Promise.all(
        publicRoadmapItems.map(async (item) =>
          item.title_en?.trim() && item.summary_en?.trim()
            ? isTranslationStale(item)
            : false,
        ),
      ),
      Promise.all(
        publicChangelogEntries.map(async (entry) =>
          entry.title_en?.trim() && entry.body_en?.trim()
            ? isTranslationStale(entry)
            : false,
        ),
      ),
    ]);

    setRoadmapItems(nextRoadmapItems);
    setChangelogEntries(nextChangelogEntries);
    setHistory(historyResult.data ?? []);
    setLatestSuccessful({
      roadmap: latestRoadmapSuccessResult.data,
      changelog: latestChangelogSuccessResult.data,
    });
    setLatestAttempt({
      roadmap: latestRoadmapAttemptResult.data,
      changelog: latestChangelogAttemptResult.data,
    });
    setReviewWarnings({
      roadmap: publicRoadmapItems.filter(roadmapNeedsReview).length,
      changelog: publicChangelogEntries.filter(changelogNeedsReview).length,
    });
    setStaleWarnings({
      roadmap: roadmapStaleStates.filter(Boolean).length,
      changelog: changelogStaleStates.filter(Boolean).length,
    });
    setPreviewGeneratedAt(new Date().toISOString());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    roadmapItems,
    changelogEntries,
    history,
    latestSuccessful,
    latestAttempt,
    reviewWarnings,
    staleWarnings,
    previewGeneratedAt,
    isLoading,
    loadError,
    reload: load,
  };
}
