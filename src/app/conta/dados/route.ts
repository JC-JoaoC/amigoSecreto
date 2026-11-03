import { getCurrentUser } from "@/server/auth/current-user";
import { exportMyData } from "@/server/services/users";

/** LGPD — download dos próprios dados em JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const data = await exportMyData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meus-dados-laco.json"',
      "Cache-Control": "no-store",
    },
  });
}
