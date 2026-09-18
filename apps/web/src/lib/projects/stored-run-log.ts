// 저장된 실행 로그를 폴더 보기 터미널(components/run-terminal.tsx)의 단계로 나눈다.
//
// 저장 로그는 packages/sandbox 의 section() 이 명령마다 "$ 명령 / 출력 / (exit N)" 로 묶어
// 빈 줄로 이은 글이다. 실시간 실행과 달리 단계 이벤트가 없어서, 명령 글자로 어느 단계인지 가린다.

export type StoredStep = "install" | "toolkit" | "test";

export type StoredSection = { step: StoredStep; exitCode: number | null; text: string };

// packages/sandbox 의 TOOLKIT_DIR·REPORT_PATH. 화면 코드가 샌드박스 SDK 를 끌어오지 않게 글자로 둔다.
const TOOLKIT_MARK = "/tmp/dante-toolkit";
const REPORT_MARK = "/tmp/dante-report.json";

const EXIT_LINE = /^\(exit (-?\d+|null)\)$/;

function stepOf(command: string): StoredStep {
  if (command.includes(REPORT_MARK)) return "test";
  if (command.includes(TOOLKIT_MARK)) return "toolkit";
  return "install";
}

export function parseStoredRunLog(logs: string): StoredSection[] {
  const sections: StoredSection[] = [];
  // joinLogs 가 긴 로그의 앞을 잘라 "$ 명령" 없이 시작할 수 있다. 그 줄들은 설치 출력으로 본다.
  let current: { step: StoredStep; lines: string[] } | null = null;

  const close = (exitCode: number | null) => {
    if (!current) return;
    const text = current.lines.join("\n").trim();
    sections.push({ step: current.step, exitCode, text });
    current = null;
  };

  for (const line of logs.split("\n")) {
    if (line.startsWith("$ ")) {
      close(null);
      current = { step: stepOf(line.slice(2)), lines: [] };
      continue;
    }
    const exit = EXIT_LINE.exec(line);
    if (exit) {
      current ??= { step: "install", lines: [] };
      close(exit[1] === "null" ? null : Number(exit[1]));
      continue;
    }
    if (current) current.lines.push(line);
    else if (line.trim()) current = { step: "install", lines: [line] };
  }
  close(null);

  return sections;
}
