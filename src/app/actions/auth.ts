"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, safeNextPath } from "@/lib/action-result";
import { runAction } from "@/server/action";
import {
  clearSessionCookie,
  getClientIp,
  getSessionToken,
  requireUserForAction,
  setSessionCookie,
} from "@/server/auth/current-user";
import { invalidateSession } from "@/server/auth/session";
import {
  changePassword,
  confirmEmail,
  loginWithPassword,
  registerUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
} from "@/server/services/auth";

type Redirect = ActionResult<{ redirectTo: string }>;

export async function registerAction(input: { name: string; email: string; password: string; next?: string }): Promise<Redirect> {
  return runAction("register", async () => {
    const session = await registerUser(input, await getClientIp());
    await setSessionCookie(session.token, session.expiresAt);
    revalidatePath("/", "layout");
    return { redirectTo: safeNextPath(input.next, "/meus-presentes?bem-vindo=1") };
  });
}

export async function loginAction(input: { email: string; password: string; next?: string }): Promise<Redirect> {
  return runAction("login", async () => {
    const session = await loginWithPassword(input, await getClientIp());
    await setSessionCookie(session.token, session.expiresAt);
    revalidatePath("/", "layout");
    return { redirectTo: safeNextPath(input.next, "/") };
  });
}

export async function forgotPasswordAction(input: { email: string }): Promise<ActionResult<{ email: string }>> {
  return runAction("forgot-password", async () => requestPasswordReset(input, await getClientIp()));
}

export async function resetPasswordAction(input: { token: string; password: string }): Promise<Redirect> {
  return runAction("reset-password", async () => {
    const session = await resetPassword(input);
    await setSessionCookie(session.token, session.expiresAt);
    revalidatePath("/", "layout");
    return { redirectTo: "/?senha=nova" };
  });
}

export async function confirmEmailAction(token: string): Promise<ActionResult<{ email: string; isOrganizer: boolean }>> {
  return runAction("confirm-email", async () => {
    const r = await confirmEmail({ token });
    revalidatePath("/", "layout");
    return r;
  });
}

export async function resendVerificationAction(): Promise<ActionResult<{ alreadyVerified: boolean }>> {
  return runAction("resend-verification", async () => {
    const user = await requireUserForAction();
    return resendVerification(user.id);
  });
}

export async function changePasswordAction(input: { current: string; password: string }): Promise<ActionResult> {
  return runAction(
    "change-password",
    async () => {
      const user = await requireUserForAction();
      await changePassword(user.id, await getSessionToken(), input);
      return undefined;
    },
    "Senha alterada. As outras sessões foram encerradas.",
  );
}

export async function logoutAction(): Promise<void> {
  await invalidateSession(await getSessionToken());
  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/?saiu=1");
}
