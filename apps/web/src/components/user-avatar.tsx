"use client";

// 로그인 사용자의 프로필 이미지. 헤더 오른쪽 끝에 들어간다.
// 이미지는 프로바이더(GitHub·Google)가 주는 URL 이라 우리 서버에 없다.
// URL 이 없거나(이메일 가입 등) 로드에 실패하면 이니셜로 떨어진다.

import { useState } from "react";
import Image from "next/image";

export function UserAvatar({ src, name }: { src: string | null; name: string }) {
  // 외부 이미지라 404·403(구글 아바타는 만료되기도 한다)이 날 수 있다.
  // 그때 깨진 이미지를 두는 대신 이니셜로 바꾼다.
  const [broken, setBroken] = useState(false);
  const showImage = src !== null && !broken;

  return (
    <span
      className="border-primary bg-muted relative block size-7 overflow-hidden rounded-full border"
      aria-hidden={showImage ? undefined : true}
    >
      {showImage ? (
        <Image
          src={src}
          alt={name}
          width={28}
          height={28}
          draggable={false}
          className="size-full object-cover select-none"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center text-[11px] font-medium uppercase">
          {name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
