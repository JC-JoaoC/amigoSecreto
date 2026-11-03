"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, safeNextPath } from "@/lib/action-result";
import { runAction } from "@/server/action";
import {
  clearSessionCookie,
  getClientIp,
  getSessionToken,
  setSessionCookie,
} from "@/server/auth/current-user";
import { invalidateSession } from "@/server/auth/session";
import { registerUser, requestLoginCode, verifyLoginCode } from "@/server/services/auth";

export async function registerAction(input: { name: string; email: string }): Promise<ActionResult<{ email: string }>> {
  return runAction("register", async () => registerUser(input, await getClientIp()));
}

export async function requestCodeAction(input: {
  email: string;
}): Promise<ActionResult<{ status: "sent" | "not_found"; email: string }>> {
  return runAction("request-code", async () => requestLoginCode(input, await getClientIp()));
}

export async function verifyCodeAction(input: {
  email: string;
  code: string;
  next?: string;
}): Promise<ActionResult<{ redirectTo: string; isNewAccount: boolean }>> {
  return runAction("verify-code", async () => {
    const session = await verifyLoginCode(input, await getClientIp());
    await setSessionCookie(session.token, session.expiresAt);
    revalidatePath("/", "layout");
    return {
      redirectTo: safeNextPath(input.next, session.isNewAccount ? "/meus-presentes?bem-vindo=1" : "/"),
      isNewAccount: session.isNewAccount,
    };
  });
}

export async function logoutAction(): Promise<void> {
  await invalidateSession(await getSessionToken());
  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/?saiu=1");
}
