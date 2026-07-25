export type HealthLevel = "excellent" | "good" | "average" | "poor";

export interface ChannelHealthScore {
  overall: number;
  level: HealthLevel;
  revenueScore: number;
  growthScore: number;
  engagementScore: number;
}

export function calculateChannelHealth(params: {
  currentRevenue: number;
  previousRevenue: number;
  currentViews: number;
  previousViews: number;
  subscribers: number;
  subscriberChange: number;
  videoCount: number;
}): ChannelHealthScore {
  const { currentRevenue, previousRevenue, currentViews, previousViews, subscribers, subscriberChange, videoCount } = params;

  let revenueScore = 50;
  if (currentRevenue > 0) {
    if (previousRevenue > 0) {
      const revGrowth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
      if (revGrowth > 20) revenueScore = 100;
      else if (revGrowth > 5) revenueScore = 80;
      else if (revGrowth > -5) revenueScore = 60;
      else if (revGrowth > -20) revenueScore = 40;
      else revenueScore = 20;
    } else {
      revenueScore = 70;
    }
  } else {
    revenueScore = 10;
  }

  let growthScore = 50;
  if (previousViews > 0) {
    const viewGrowth = ((currentViews - previousViews) / previousViews) * 100;
    if (viewGrowth > 20) growthScore = 100;
    else if (viewGrowth > 5) growthScore = 80;
    else if (viewGrowth > -5) growthScore = 60;
    else if (viewGrowth > -20) growthScore = 40;
    else growthScore = 20;
  }
  if (subscriberChange > 0) growthScore = Math.min(100, growthScore + 10);

  let engagementScore = 50;
  if (subscribers > 100000) engagementScore += 20;
  else if (subscribers > 10000) engagementScore += 10;
  if (videoCount > 100) engagementScore += 10;
  else if (videoCount > 20) engagementScore += 5;
  if (currentViews > 0 && subscribers > 0) {
    const viewsPerSub = currentViews / subscribers;
    if (viewsPerSub > 1) engagementScore += 20;
    else if (viewsPerSub > 0.3) engagementScore += 10;
  }
  engagementScore = Math.min(100, engagementScore);

  const overall = Math.round(revenueScore * 0.4 + growthScore * 0.35 + engagementScore * 0.25);

  let level: HealthLevel = "poor";
  if (overall >= 75) level = "excellent";
  else if (overall >= 55) level = "good";
  else if (overall >= 35) level = "average";

  return { overall, level, revenueScore, growthScore, engagementScore };
}

export function getHealthColor(level: HealthLevel): string {
  switch (level) {
    case "excellent": return "text-green-600 bg-green-100";
    case "good": return "text-blue-600 bg-blue-100";
    case "average": return "text-amber-600 bg-amber-100";
    case "poor": return "text-red-600 bg-red-100";
  }
}

export function getHealthEmoji(level: HealthLevel): string {
  switch (level) {
    case "excellent": return "Excellent";
    case "good": return "Good";
    case "average": return "Average";
    case "poor": return "Needs Attention";
  }
}
