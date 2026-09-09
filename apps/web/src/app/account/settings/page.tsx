import { redirect } from "next/navigation";

// /account/settings 자체에는 내용이 없다. 첫 항목으로 보낸다.
// 링크를 /account/settings 로 걸어둔 곳이 깨지지 않게 하려는 자리.
export default function AccountSettingsIndex() {
  redirect("/account/settings/general");
}
