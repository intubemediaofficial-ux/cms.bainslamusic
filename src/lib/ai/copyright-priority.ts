import "server-only";

import {
  getMatches,
  getSongs,
  type CopyrightMatch,
} from "@/lib/copyright-catalog";

export interface CopyrightPriorityItem {
  id: string;
  songTitle: string;
  videoTitle: string;
  videoUrl: string;
  channelTitle: string;
  views: number;
  matchScore: number;
  status: CopyrightMatch["status"];
  detectedAt: string;
  priorityScore: number;
  reasons: string[];
}

export interface CopyrightPriorityResult {
  unresolvedCount: number;
  highPriorityCount: number;
  items: CopyrightPriorityItem[];
}

export async function buildCopyrightPriority(): Promise<CopyrightPriorityResult> {
  const [matches, songs] = await Promise.all([getMatches(), getSongs()]);
  const songPriority = new Map(songs.map((song) => [song.id, song.priority]));
  const unresolved = matches.filter(
    (match) => match.status === "new" || match.status === "confirmed"
  );
  const items = unresolved
    .map((match) => {
      const reasons: string[] = [];
      let priorityScore = match.matchScore * 0.65;
      const viewWeight = Math.min(20, Math.log10(Math.max(1, match.views) + 1) * 4);
      priorityScore += viewWeight;
      if (songPriority.get(match.songId) === "high") {
        priorityScore += 10;
        reasons.push("High-priority catalog song");
      }
      if (match.status === "confirmed") {
        priorityScore += 8;
        reasons.push("Already confirmed by Admin");
      }
      if (match.matchScore >= 85) reasons.push("Very high title-match confidence");
      else if (match.matchScore >= 70) reasons.push("Strong title-match confidence");
      if (match.views >= 100000) reasons.push("High-view suspected upload");
      else if (match.views >= 10000) reasons.push("Material audience reach");
      const ageDays = (Date.now() - Date.parse(match.detectedAt)) / 86400000;
      if (Number.isFinite(ageDays) && ageDays <= 14) {
        priorityScore += 4;
        reasons.push("Recently detected");
      }
      return {
        id: match.id,
        songTitle: match.songTitle,
        videoTitle: match.videoTitle,
        videoUrl: match.videoUrl,
        channelTitle: match.channelTitle,
        views: match.views,
        matchScore: match.matchScore,
        status: match.status,
        detectedAt: match.detectedAt,
        priorityScore: Math.min(100, Math.round(priorityScore)),
        reasons,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || b.views - a.views)
    .slice(0, 50);

  return {
    unresolvedCount: unresolved.length,
    highPriorityCount: items.filter((item) => item.priorityScore >= 75).length,
    items,
  };
}
