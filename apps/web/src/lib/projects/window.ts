// 대시보드 Usage 카드들이 공유하는 기간·버킷 헬퍼.
//
// 모든 활동 series 가 같은 창(최근 N일)과 같은 버킷을 써야 막대가 나란히 정렬된다.
// activity.ts(알림 전달)와 test-metrics.ts(실행·생성)가 함께 쓴다.

import { startOfDay, subDays } from "date-fns";

/** 최근 N일. 하루 = 막대 하나. */
export const ACTIVITY_DAYS = 7;

/** UsageSection 카드 하나의 형태 (mock-data 의 UsageSeries 와 동일 구조). */
export interface ActivitySeries {
  key: string;
  label: string;
  total: number;
  failed: number;
  errors: number;
  points: number[];
}

/** [오늘 포함 최근 N일의 시작, 지금]. from 은 자정에 맞춘다. */
export function activityWindow(now = new Date()) {
  return { from: startOfDay(subDays(now, ACTIVITY_DAYS - 1)), to: now };
}

/** 0 으로 채운 하루-버킷 배열. */
export function emptyBuckets() {
  return new Array<number>(ACTIVITY_DAYS).fill(0);
}

/** 시각 → 0..ACTIVITY_DAYS-1 버킷 인덱스. 경계 반올림은 양끝으로 클램프. */
export function dayIndex(date: Date, from: Date) {
  const day = Math.floor((date.getTime() - from.getTime()) / 86_400_000);
  return Math.min(ACTIVITY_DAYS - 1, Math.max(0, day));
}
