// 브라우저에서 에디터로 넘어가는 링크가 닿지 않을 때 쓰는 방법 안내.
//
// 여기에 코드 입력창을 두지 않는 이유: 에디터가 보여준 코드를 웹에 입력하는 방식(디바이스 플로우)은
// 공격자가 자기 코드를 입력하게 유도하는 것만으로 계정이 넘어간다. 그래서 반대로, 웹이 코드를
// 보여주고 에디터에 붙여넣게 했다 — 코드는 그 로그인을 시작한 에디터의 verifier 없이는 쓸 수 없다.
export function PairingCodeGuide() {
  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="font-heading text-[15px] leading-tight font-medium">Pairing codes</h2>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
        For when signing in never makes it back to your editor, such as over Remote SSH, in
        Codespaces, or when your browser is on another device.
      </p>

      <ol className="border-border bg-card text-muted-foreground mt-3 list-decimal space-y-2 border p-5 pl-9 text-[13px] leading-relaxed">
        <li>
          In your editor, run{" "}
          <span className="text-foreground font-mono">Dante: Sign in with code</span> from the
          command palette.
        </li>
        <li>Open the link it gives you, sign in, and choose Connect.</li>
        <li>Paste the code shown on that page back into your editor within 5 minutes.</li>
      </ol>
    </section>
  );
}
