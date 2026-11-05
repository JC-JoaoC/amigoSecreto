import type { Metadata } from "next";
import { Container } from "@/components/ui/misc";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacidade e dados" };

const sections = [
  {
    title: "Quais dados coletamos",
    body: "Nome, e-mail e senha no cadastro, a foto de perfil (opcional), os presentes que você mesmo adiciona, sua participação nos sorteios e as mensagens anônimas que você enviar. Não pedimos telefone, CPF nem endereço.",
  },
  {
    title: "Para que usamos",
    body: "Para você entrar na sua conta, recuperar a senha e confirmar o e-mail (por links enviados ao seu e-mail), mostrar sua lista de desejos aos participantes, realizar os sorteios, entregar as mensagens ao seu par e avisar quando um sorteio acontecer. Não vendemos nem repassamos seus dados.",
  },
  {
    title: "O que fica visível",
    body: "Seu nome, sua foto (se você colocar) e sua lista de presentes aparecem para quem usa a plataforma, porque esse é o objetivo do amigo secreto. Seu e-mail não aparece para ninguém.",
  },
  {
    title: "Como protegemos",
    body: "Sua senha é guardada só como hash (scrypt), nunca em texto. Tokens de sessão e links enviados por e-mail também ficam só como hash. O resultado de cada sorteio e o texto das mensagens anônimas são cifrados (AES-256-GCM): entre os participantes, só a própria pessoa vê quem tirou, e as mensagens não registram quem as escreveu. O organizador do sorteio consegue consultar os pares e o texto das mensagens (por exemplo, para resolver um problema), e cada consulta fica registrada.",
  },
  {
    title: "Cookies",
    body: "Usamos um único cookie essencial, de sessão, para manter você conectado. Nada de rastreamento ou publicidade.",
  },
  {
    title: "Seus direitos (LGPD)",
    body: "Em “Conta” você corrige seu nome, baixa uma cópia dos seus dados e exclui a conta. Se você estiver num sorteio já realizado, a exclusão é liberada quando o organizador excluir o sorteio, para não prejudicar os outros participantes.",
  },
  {
    title: "Por quanto tempo guardamos",
    body: "Enquanto sua conta existir. Links para criar nova senha expiram em 30 minutos; sessões, em até 30 dias sem uso. Excluir um sorteio apaga seus resultados e mensagens. Excluir a conta apaga seus dados pessoais e presentes.",
  },
];

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <h1 className="text-[28px] font-bold leading-tight text-ink">Privacidade e proteção de dados</h1>
      <p className="mt-2 text-base text-ink">
        Como o <span translate="no">{BRAND.name}</span> trata suas informações, de acordo com a Lei Geral de Proteção de Dados (Lei
        13.709/2018).
      </p>
      <div className="mt-10 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-bold text-ink">{s.title}</h2>
            <p className="mt-2 text-base leading-7 text-ink">{s.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 text-[15px] text-ink-2">
        Dúvidas ou pedidos sobre seus dados? Fale com o organizador da sua turma ou com o responsável pela plataforma.
      </p>
    </Container>
  );
}
