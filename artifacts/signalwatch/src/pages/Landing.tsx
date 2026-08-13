import { BookOpen, ChevronRight, FileText, Lock, Scale, ShieldCheck, Target, Terminal, Zap } from 'lucide-react';
import { Link } from 'wouter';

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="36" height="36" rx="9" fill="#ffffff" stroke="#e8e5df" strokeWidth="1"/>
        <path d="M 11 9.5 C 12 20 25.5 15 25.5 27" stroke="#0f0f0f" strokeWidth="3.2" strokeLinecap="round" fill="none"/>
        <circle cx="11" cy="9.5" r="3.4" fill="#0f0f0f"/>
        <circle cx="25.5" cy="27" r="4.5" stroke="#e8531a" strokeWidth="2.8" fill="#ffffff"/>
      </svg>
      <div className="flex flex-col leading-none">
        <span className="text-[11px] font-bold uppercase tracking-[.22em] text-[#e8531a]">ViaX</span>
        <span className="text-base font-bold tracking-[-0.02em] text-foreground">Trace</span>
      </div>
    </div>
  );
}

const PREVIEW_ALERTS = [
  { id: 'a-1', groupName: 'Promos Eletrônicos BR', message: 'iPhone 15 Pro Max 256GB por R$4.299 — loja parceira, frete grátis SP/RJ.', keyword: 'iphone' },
  { id: 'a-2', groupName: 'Ofertas Games 🎮', message: 'PS5 Slim + controle extra R$2.890 à vista. Estoque limitado, entrega imediata.', keyword: 'ps5' },
  { id: 'a-3', groupName: 'Cupons & Cashback', message: 'Samsung Galaxy S24 com 30% de desconto + 10% cashback via Pix no app.', keyword: 'samsung' },
];

export default function Landing() {
  return (
    <div className="vx-noise min-h-[100dvh] overflow-hidden bg-background text-foreground">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground md:flex">
          <a href="#como-funciona" className="hover:text-[#e8531a]">Como funciona</a>
          <a href="#diferenciais" className="hover:text-[#e8531a]">Diferenciais</a>
          <Link href="/privacy" className="hover:text-[#e8531a]">Privacidade</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-[#e8e5df] hover:text-foreground" data-testid="link-landing-sign-in">
            Entrar
          </Link>
          <Link href="/sign-up" className="rounded-lg bg-[#e8531a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#d44517]" data-testid="link-landing-sign-up">
            Criar conta
          </Link>
        </div>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="mx-auto grid max-w-7xl gap-14 px-5 pb-24 pt-16 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:px-10 lg:pt-20">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e8531a]/20 bg-[#fee8da] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.15em] text-[#c43e12]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e8531a]" />
              Captura de promoções · Tempo real
            </div>

            <h1 className="max-w-lg text-[2.9rem] font-bold leading-[1.06] tracking-[-0.055em] text-foreground lg:text-[3.9rem]">
              Capture promoções antes que<br />
              <span className="text-[#e8531a]">todo mundo veja.</span>
            </h1>

            <p className="mt-6 max-w-md text-[0.95rem] leading-[1.85] text-muted-foreground">
              ViaX: Trace monitora grupos do Telegram pela palavra-chave que você definiu. Quando uma promoção aparece, você é o primeiro a saber — com controle total sobre o que é monitorado.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-in" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e8531a] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(232,83,26,.28)] hover:bg-[#d44517]" data-testid="link-hero-start">
                Acessar plataforma <ChevronRight size={16} />
              </Link>
              <Link href="/privacy" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold text-muted-foreground hover:bg-background" data-testid="link-hero-docs">
                Política de privacidade
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { icon: Zap, label: 'Tempo real', sub: 'Detecção instantânea' },
                { icon: Target, label: 'Por keyword', sub: 'Você define o radar' },
                { icon: Lock, label: 'Sessão segura', sub: 'AES-256-GCM' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#fee8da] text-[#e8531a]">
                    <Icon size={13} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">{label}</div>
                    <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mock dashboard */}
          <div className="relative">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#fcc4a0] opacity-40 blur-3xl" />
            <div className="relative rounded-[24px] border border-[#e8531a]/20 bg-[#fee8da] p-3 shadow-[0_28px_72px_rgba(232,83,26,.18)] lg:rotate-[1deg]">
              {/* This card is intentionally always light — it's a product screenshot mockup */}
              <div className="overflow-hidden rounded-[18px] border border-[#f0c8b0] bg-[#fffcfa]">
                <div className="flex items-center justify-between border-b border-[#f0c8b0] bg-[#fff8f4] px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="grid h-6 w-6 place-items-center rounded-lg bg-[#0f0f0f] text-white">
                      <Terminal size={12} />
                    </div>
                    <span className="text-sm font-bold text-[#0f0f0f]">trace / hoje</span>
                  </div>
                  <span className="font-mono text-[9px] text-[#9a9490]">LIVE · 24 capturas</span>
                </div>
                <div className="grid grid-cols-[1fr_1.35fr]">
                  <div className="border-r border-[#f0c8b0] bg-[#fff4ee] p-4">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-[#9a9490]">Panorama</div>
                    <div className="mt-4 text-3xl font-bold tracking-[-0.06em] text-[#0f0f0f]">24</div>
                    <div className="text-[10px] text-[#6b6560]">promos hoje</div>
                    <div className="mt-5 space-y-2.5">
                      {[['Não lidas', '08', 'bg-[#e8531a]'], ['Regras', '02', 'bg-[#0f0f0f]'], ['Grupos', '04', 'bg-[#c43e12]']].map(([label, count, color]) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-[10px] text-[#6b6560]">{label}</span>
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#0f0f0f]">
                            <i className={`h-1.5 w-1.5 rounded-full ${color}`} />{count}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-7 rounded-lg bg-[#fee0cc] p-2.5">
                      <div className="flex items-center gap-1 text-[9px] font-bold text-[#c43e12]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#e8531a]" /> radar ativo
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#fcc4a0]">
                        <div className="h-full w-3/4 bg-[#e8531a]" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-[#9a9490]">Capturas recentes</div>
                    <div className="mt-3 space-y-2.5">
                      {PREVIEW_ALERTS.map((a, i) => (
                        <div key={a.id} className={`rounded-lg border p-2.5 ${i === 0 ? 'border-[#f0c8b0] bg-[#fff4ee]' : 'border-[#e4e1db] bg-white'}`}>
                          <div className="flex items-center gap-1 text-[8px] font-bold text-[#c43e12]">
                            <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-[#e8531a]' : 'bg-[#c8c4be]'}`} />
                            {a.groupName}
                          </div>
                          <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#0f0f0f]">{a.message}</div>
                          <div className="mt-1.5">
                            <span className="rounded bg-[#fee8da] px-1.5 py-0.5 font-mono text-[7px] text-[#e8531a]">#{a.keyword}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Como funciona ──────────────────────────────────────────────── */}
        <section id="como-funciona" className="border-y border-border bg-card px-5 py-20 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-xl">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[.17em] text-[#e8531a]">Fluxo operacional</div>
              <h2 className="text-3xl font-bold leading-tight tracking-[-0.045em] text-foreground lg:text-4xl">
                Do grupo ao alerta.<br />Em segundos.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Configure uma vez. O ViaX: Trace fica rodando, varrendo os grupos escolhidos, e notifica você assim que a palavra-chave aparecer — sem ruído, sem delay.
              </p>
            </div>

            <div className="relative">
              <div className="absolute left-[22px] top-8 hidden h-[calc(100%-64px)] w-px bg-[#e4e1db] md:block" />
              <div className="space-y-6">
                {[
                  {
                    n: '01',
                    title: 'Conecte sua conta Telegram via QR Code',
                    body: 'Autenticação direta pelo QR do Telegram. Nenhuma senha é digitada na plataforma. A sessão fica criptografada e vinculada exclusivamente à sua conta.',
                    badge: 'Sem senha · Seguro',
                  },
                  {
                    n: '02',
                    title: 'Defina palavras-chave e grupos-alvo',
                    body: 'Configure quais grupos monitorar e quais palavras ativam um alerta. Use operadores de exclusão para filtrar ruído. Cada regra tem cooldown e prioridade configuráveis.',
                    badge: 'Precisão total',
                  },
                  {
                    n: '03',
                    title: 'Receba capturas no inbox em tempo real',
                    body: 'Cada alerta inclui grupo, horário, fragmento da mensagem e keyword acionada. Favorite, marque como lido ou arquive. Tudo rastreável e auditável.',
                    badge: 'Rastreável · Auditável',
                  },
                ].map(({ n, title, body, badge }) => (
                  <div key={n} className="relative flex gap-6 rounded-2xl border border-border bg-card p-6 shadow-[0_2px_12px_rgba(0,0,0,.05)]">
                    <div className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0f0f0f] text-white text-sm font-bold">
                      {n}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-foreground">{title}</h3>
                        <span className="rounded-full bg-[#fee8da] px-2.5 py-1 text-[10px] font-bold text-[#c43e12]">{badge}</span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Diferenciais ───────────────────────────────────────────────── */}
        <section id="diferenciais" className="mx-auto max-w-7xl px-5 py-20 lg:px-10">
          <div className="mb-12 max-w-xl">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[.17em] text-[#e8531a]">Por que ViaX: Trace</div>
            <h2 className="text-3xl font-bold leading-tight tracking-[-0.045em] text-foreground lg:text-4xl">
              Controle total.<br />Sem compromisso com o ruído.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                n: '01',
                icon: Target,
                title: 'Detecção por intenção',
                body: 'As regras são definidas com palavras-chave, operadores lógicos e exclusões explícitas. O sistema não infere — executa exatamente o que foi configurado.',
              },
              {
                n: '02',
                icon: ShieldCheck,
                title: 'Sessão isolada por conta',
                body: 'Cada conta opera com sua própria sessão Telegram criptografada com AES-256-GCM. Nenhum dado de grupo ou mensagem é compartilhado entre usuários.',
              },
              {
                n: '03',
                icon: Scale,
                title: 'Auditabilidade completa',
                body: 'Cada captura registra origem, horário e regra que a gerou. O histórico é auditável e deletável a qualquer momento diretamente nas configurações.',
              },
            ].map(({ n, icon: Icon, title, body }) => (
              <div key={n} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#fee8da] text-[#e8531a]">
                    <Icon size={16} />
                  </div>
                  <span className="font-mono text-xs font-bold text-[#9a9490]">{n}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-2.5 text-sm leading-[1.75] text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Conformidade ───────────────────────────────────────────────── */}
        <section className="border-y border-border bg-muted px-5 py-20 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 grid gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[.17em] text-[#e8531a]">Privacidade e conformidade</div>
                <h2 className="text-3xl font-bold leading-tight tracking-[-0.045em] text-foreground lg:text-4xl">
                  Seus dados, seu controle,<br />sua jurisdição.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                  A arquitetura foi projetada com isolamento como premissa — não como recurso adicional. Abaixo estão os compromissos estruturais do produto.
                </p>
              </div>
              <div className="flex items-start">
                <Link href="/privacy" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-[#e8531a] hover:bg-accent">
                  <FileText size={15} />
                  Política de privacidade
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Lock, title: 'AES-256-GCM', body: 'Sessões Telegram criptografadas com chave derivada por conta. Nenhuma sessão de terceiros tem acesso cruzado.' },
                { icon: ShieldCheck, title: 'Conformidade LGPD', body: 'Dados tratados estritamente conforme o escopo autorizado. Solicitação de exclusão disponível nas configurações.' },
                { icon: Scale, title: 'Dados por usuário', body: 'Histórico, grupos, regras e alertas ficam segregados por conta. Nada é compartilhado ou agregado entre usuários.' },
                { icon: BookOpen, title: 'Auditoria de acesso', body: 'Cada sessão ativa é registrada com dispositivo, IP e horário. Revogue acesso de dispositivos suspeitos na plataforma.' },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-5">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Icon size={16} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Documentação ───────────────────────────────────────────────── */}
        <section className="border-y border-border bg-card px-5 py-16 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 text-[11px] font-bold uppercase tracking-[.17em] text-[#e8531a]">Estrutura legal e técnica</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: FileText, label: 'Termos de uso', href: '/terms', desc: 'Condições de uso da plataforma, limitações de responsabilidade e escopo do serviço.' },
                { icon: ShieldCheck, label: 'Política de privacidade', href: '/privacy', desc: 'Como os dados são coletados, processados e protegidos conforme a LGPD.' },
                { icon: BookOpen, label: 'Central de ajuda', href: '/privacy', desc: 'Documentação operacional, FAQs e guias de configuração de regras e conexão.' },
              ].map(({ icon: Icon, label, href, desc }) => (
                <Link key={label} href={href} className="group flex gap-4 rounded-xl border border-border bg-card p-5 hover:border-[#e8531a]/30 hover:shadow-[0_4px_16px_rgba(232,83,26,.08)]">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fee8da] text-[#e8531a] group-hover:bg-accent">
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{label}</div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-5 py-8 sm:flex-row sm:items-center lg:px-10">
          <Logo />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link href="/terms" className="hover:text-[#e8531a]" data-testid="link-footer-terms">Termos de uso</Link>
            <Link href="/privacy" className="hover:text-[#e8531a]" data-testid="link-footer-privacy">Privacidade</Link>
            <span className="text-[#9a9490]">© 2026 ViaX: Trace</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
