// 실행을 한 번에 하나씩, 들어온 순서대로 돌린다.
//
// 샌드박스를 동시에 여러 개 만들지 않으려는 것이다. Vercel Sandbox 무료 플랜의 동시 실행
// 수와 맞춰 하나로 둔다. 요청이 겹치면 뒤 요청은 앞 실행이 끝날 때까지 응답을 기다린다.
//
// 외부 큐가 아니라 프로세스 안의 Promise 사슬인 이유: runner 는 인스턴스 하나로 돌고,
// 결과는 요청 응답으로 돌려준다(index.ts). 재시작하면 기다리던 요청도 같이 끊기므로
// 잃어버릴 작업이 따로 남지 않는다.

export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  let size = 0;

  return {
    /** 앞 작업이 끝나면 task 를 돌린다. 앞 작업이 실패해도 뒤 작업은 돈다. */
    run<T>(task: () => Promise<T>): Promise<T> {
      size++;
      const result = tail.then(task).finally(() => {
        size--;
      });
      tail = result.catch(() => {});
      return result;
    },
    /** 돌고 있는 것과 기다리는 것을 합한 수 */
    get size() {
      return size;
    },
  };
}
