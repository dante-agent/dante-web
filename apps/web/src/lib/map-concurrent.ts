// 동시에 limit 개까지만 돌리는 map. 결과는 입력 순서 그대로다.
//
// 의존성(p-limit 등)을 넣지 않는 이유: 이 몇 줄이 전부다(AGENTS.md: 몇 줄로 될 일은 직접).
// 순수 함수라 node --test 로 바로 돈다.

export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  // 일꾼 limit 개가 남은 항목을 하나씩 가져간다. 하나가 던지면 Promise.all 처럼 전체가 던진다.
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
