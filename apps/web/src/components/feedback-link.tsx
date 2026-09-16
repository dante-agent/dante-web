// 헤더의 Feedback 버튼 → 구글폼 설문을 새 탭으로 연다.
// 예전에는 모달 + Resend 메일이었는데, 설문 문항을 코드 배포 없이 고치려고 구글폼으로 옮겼다.

import { Button } from "@/components/ui/button";

// 편집용 주소(/forms/d/<id>)가 아니라 응답용 게시 주소. 편집용은 소유자만 열린다.
const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdEJ2ki4iWdcDLwBLCULBYXjRDPsJ76R7h59WhhyZ6onTBokQ/viewform";

export function FeedbackLink() {
  return (
    <Button
      variant="ghost"
      size="sm"
      render={<a href={FORM_URL} target="_blank" rel="noreferrer noopener" />}
    >
      Feedback
    </Button>
  );
}
