export type GroupingSuggestionAction = 'merge_series' | 'add_as_season' | 'ignore';
export type GroupingSuggestionStatus = 'pending' | 'accepted' | 'rejected';
export type GroupingSourceType = 'series' | 'season' | 'unmatched';

export interface GroupingSuggestion {
  id: number;
  sourceType: GroupingSourceType;
  sourceId: number | null;
  sourceName: string;
  targetSeriesId: number | null;
  targetSeriesName: string;
  similarityScore: number;
  suggestedAction: GroupingSuggestionAction;
  suggestedSeasonName: string | null;
  status: GroupingSuggestionStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}
