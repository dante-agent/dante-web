import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FolderTestShare } from "../mock-data";

const SHARE_COLOR = ["bg-brand-orange", "bg-brand-cobalt", "bg-brand-mint", "bg-muted-foreground"];

export function FolderRatioCard({
  totalFiles,
  folders,
}: {
  totalFiles: number;
  folders: FolderTestShare[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>폴더별 테스트 코드 비율</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-bold">
          {totalFiles}
          <span className="text-muted-foreground ml-1.5 text-sm font-normal">개 테스트 파일</span>
        </p>

        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
          {folders.map((folder, i) => (
            <div
              key={folder.name}
              className={SHARE_COLOR[i % SHARE_COLOR.length]}
              style={{ width: `${folder.pct}%` }}
            />
          ))}
        </div>

        <ul className="mt-4 flex flex-col gap-2.5">
          {folders.map((folder, i) => (
            <li key={folder.name} className="flex items-center gap-2.5 text-sm">
              <span
                className={`size-2 shrink-0 rounded-full ${SHARE_COLOR[i % SHARE_COLOR.length]}`}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{folder.name}</span>
              <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
                <div
                  className={`h-full ${SHARE_COLOR[i % SHARE_COLOR.length]}`}
                  style={{ width: `${folder.pct}%` }}
                />
              </div>
              <span className="text-muted-foreground w-7 shrink-0 text-right font-mono text-xs">
                {folder.count}
              </span>
              <span className="text-muted-foreground w-9 shrink-0 text-right font-mono text-xs">
                {folder.pct}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
