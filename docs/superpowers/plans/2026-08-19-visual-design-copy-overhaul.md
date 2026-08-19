# Revisão de Design Visual e Copy — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os dois bugs visuais sistêmicos (sombras zeradas, nenhum botão com feedback de toque) por trás da queixa original do menu de três pontinhos, alinhar o copy do app e da landing ao posicionamento aprovado ("monitoramento genérico de Telegram, vendido através de 4 casos de uso concretos"), e remover o resíduo de copy B2B genérico que não bate com nenhum caso de uso real.

**Architecture:** Nenhuma mudança estrutural. Todo o trabalho é CSS (tokens em `src/index.css`) e edições pontuais de string/JSX em `src/App.tsx` e `src/pages/Landing.tsx` — os mesmos arquivos únicos já usados no resto do projeto (padrão estabelecido, não será dividido). O sistema de elevação por toque (`hover-elevate`/`active-elevate`) já existe em `index.css` mas nunca foi usado em nenhum componente — este plano conecta componentes existentes a ele em vez de inventar um novo mecanismo.

**Tech Stack:** React + TypeScript + Tailwind CSS v4 (tokens via `@theme`), Vite. Sem framework de teste de componente neste projeto — a verificação de cada tarefa é `tsc --noEmit` (correção de tipos) mais uma checagem visual manual descrita em cada passo, seguindo o mesmo padrão de verificação usado no resto do projeto até aqui.

**Spec:** `docs/superpowers/specs/2026-08-19-visual-design-copy-overhaul.md`

## Global Constraints

- Nenhuma mudança de lógica de backend, rota ou fluxo de dados — só CSS e texto/JSX estático.
- Nenhum arquivo novo é criado; nenhuma divisão de `App.tsx`/`Landing.tsx` (padrão de arquivo único já estabelecido no projeto).
- Voz de copy: frases curtas, verbo de ação + resultado concreto, zero adjetivo vago ("eficiente", "poderoso", "oportunidades" solta sem contexto).
- Os 4 casos de uso oficiais, nesta ordem de prioridade: Eletrônicos & celulares (carro-chefe) → Imóveis → Vagas & oportunidades de trabalho → Licitações & fornecedores.
- Todo componente interativo (botão, item clicável) precisa de feedback visual perceptível em toque de celular, não só em `:hover` de mouse.
- Depois de cada tarefa: rodar `npx tsc --noEmit -p artifacts/signalwatch/tsconfig.json` a partir de `/home/kali/signalwatch` e confirmar zero erros antes de seguir para a próxima.

---

## Task 1: Preencher os tokens de sombra (`--shadow-*`)

**Files:**
- Modify: `artifacts/signalwatch/src/index.css:154-161` (light mode), `:227-234` (dark mode)

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: as classes utilitárias `shadow-sm`/`shadow-md`/`shadow-lg`/`shadow-xl`/`shadow-2xl` do Tailwind passam a renderizar sombra visível em qualquer componente que já as usa — inclusive as 7 superfícies identificadas na spec (menu de três pontinhos, painel de notificações, cartão de login, modal de regras, cartão de QR code, entre outras). Nenhuma tarefa depois desta depende do nome de uma variável nova — só do efeito visual.

- [ ] **Step 1: Ler o estado atual do bloco `:root` (light mode)**

Confirmar que o bloco em `index.css` linhas 154-161 ainda é exatamente:

```css
  --shadow-2xs: 0px 2px 0px 0px rgba(0,0,0,0);
  --shadow-xs: 0px 2px 0px 0px rgba(0,0,0,0);
  --shadow-sm: 0px 2px 0px 0px rgba(0,0,0,0), 0px 1px 2px -1px rgba(0,0,0,0);
  --shadow: 0px 2px 0px 0px rgba(0,0,0,0), 0px 1px 2px -1px rgba(0,0,0,0);
  --shadow-md: 0px 2px 0px 0px rgba(0,0,0,0), 0px 2px 4px -1px rgba(0,0,0,0);
  --shadow-lg: 0px 2px 0px 0px rgba(0,0,0,0), 0px 4px 6px -1px rgba(0,0,0,0);
  --shadow-xl: 0px 2px 0px 0px rgba(0,0,0,0), 0px 8px 10px -1px rgba(0,0,0,0);
  --shadow-2xl: 0px 2px 0px 0px rgba(0,0,0,0);
```

- [ ] **Step 2: Substituir pelos valores reais (light mode)**

O valor de referência já usado e aprovado no projeto é o de `.vx-card`/`.sw-card`: `0 8px 24px rgba(0,0,0,.06)`. Os tokens abaixo escalam esse mesmo tom de preto a 6% a partir dele, do menor ao maior — mantendo a paleta quente (preto puro, sem tingimento colorido, que é o que `.vx-card` já faz e funciona bem em ambos os temas):

```css
  --shadow-2xs: 0px 1px 2px 0px rgba(0,0,0,.03);
  --shadow-xs: 0px 1px 3px 0px rgba(0,0,0,.04);
  --shadow-sm: 0px 2px 4px -1px rgba(0,0,0,.05), 0px 1px 2px -1px rgba(0,0,0,.04);
  --shadow: 0px 2px 6px -1px rgba(0,0,0,.06), 0px 1px 2px -1px rgba(0,0,0,.04);
  --shadow-md: 0px 6px 12px -2px rgba(0,0,0,.07), 0px 2px 4px -2px rgba(0,0,0,.05);
  --shadow-lg: 0px 12px 20px -4px rgba(0,0,0,.09), 0px 4px 6px -2px rgba(0,0,0,.05);
  --shadow-xl: 0px 20px 32px -6px rgba(0,0,0,.12), 0px 8px 10px -4px rgba(0,0,0,.06);
  --shadow-2xl: 0px 28px 48px -8px rgba(0,0,0,.16);
```

- [ ] **Step 3: Substituir pelos valores reais (dark mode)**

No bloco `.dark` (linhas 227-234), mesma estrutura mas com alpha maior — sombra preta pura fica pouco visível sobre fundo já escuro, então sobe a opacidade proporcionalmente:

```css
  --shadow-2xs: 0px 1px 2px 0px rgba(0,0,0,.18);
  --shadow-xs: 0px 1px 3px 0px rgba(0,0,0,.22);
  --shadow-sm: 0px 2px 4px -1px rgba(0,0,0,.28), 0px 1px 2px -1px rgba(0,0,0,.22);
  --shadow: 0px 2px 6px -1px rgba(0,0,0,.32), 0px 1px 2px -1px rgba(0,0,0,.22);
  --shadow-md: 0px 6px 12px -2px rgba(0,0,0,.36), 0px 2px 4px -2px rgba(0,0,0,.26);
  --shadow-lg: 0px 12px 20px -4px rgba(0,0,0,.42), 0px 4px 6px -2px rgba(0,0,0,.28);
  --shadow-xl: 0px 20px 32px -6px rgba(0,0,0,.5), 0px 8px 10px -4px rgba(0,0,0,.32);
  --shadow-2xl: 0px 28px 48px -8px rgba(0,0,0,.58);
```

- [ ] **Step 4: Typecheck (não afeta TS, mas confirma que nada quebrou no build)**

Run: `cd /home/kali/signalwatch && npx tsc --noEmit -p artifacts/signalwatch/tsconfig.json`
Expected: zero erros (CSS não é verificado por `tsc`, este passo só garante que o resto do projeto segue íntegro).

- [ ] **Step 5: Verificação visual manual**

Com o dev server rodando (`viax-trace status` para confirmar), abrir `/app/alerts`, clicar nos três pontinhos de um alerta e confirmar visualmente que o menu agora tem sombra perceptível se destacando do fundo — tanto no tema claro quanto no escuro (alternar em Configurações). Repetir a checagem no painel de notificações (sino no header) e no modal de "Nova regra".

- [ ] **Step 6: Commit**

```bash
cd /home/kali/signalwatch
git add artifacts/signalwatch/src/index.css
git commit -m "Fill in zeroed-out shadow tokens for light and dark mode

The --shadow-* CSS variables were all rgba(0,0,0,0) — fully
transparent, leftover from an uncustomized shadcn template. Every
floating surface using shadow-sm through shadow-2xl (the alert
dropdown menu, notification panel, sign-in card, rule modal, QR
card) rendered with no shadow at all."
```

---

## Task 2: Conectar o sistema de elevação (`hover-elevate`/`active-elevate`) aos botões

**Files:**
- Modify: `artifacts/signalwatch/src/App.tsx` — componente `Button` (linha ~197), `AlertRow` (botões de ícone, linhas ~579 e ~583), `NotificationPanel` (botão de fechar e sino, linhas ~264 e no header do `AppShell`)

**Interfaces:**
- Consumes: nada de tarefas anteriores (independente da Task 1, mas melhor visualizado depois dela já que agora as sombras aparecem).
- Produces: nenhuma interface nova — é uma troca de classe CSS em botões já existentes.

O CSS de `hover-elevate`/`active-elevate` já existe em `index.css` (`.hover-elevate`, `.active-elevate`, variáveis `--elevate-1`/`--elevate-2`) mas nunca foi referenciado em nenhum componente. `active-elevate` responde ao `:active` real do CSS, que dispara em toque de celular (diferente de `:hover`, que não é confiável em touch) — é exatamente o mecanismo que falta.

- [ ] **Step 1: Atualizar o componente `Button` compartilhado**

Ler o estado atual (deve bater com isto, em `App.tsx` por volta da linha 197):

```tsx
function Button({ children, className = '', variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_7px_18px_rgba(232,83,26,.18)]',
    secondary: 'border border-border bg-card text-foreground hover:bg-accent',
    ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
    danger: 'border border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20',
  };
  return <button className={`sw-transition inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
```

Substituir por (adiciona `hover-elevate active-elevate` a cada variante, mantendo a cor de base de cada uma — o overlay do sistema de elevação funciona por cima de qualquer cor):

```tsx
function Button({ children, className = '', variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground shadow-[0_7px_18px_rgba(232,83,26,.18)]',
    secondary: 'border border-border bg-card text-foreground',
    ghost: 'text-muted-foreground hover:text-foreground',
    danger: 'border border-destructive bg-destructive/10 text-destructive',
  };
  return <button className={`sw-transition hover-elevate active-elevate inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
```

(`hover:bg-*` removido de cada variante porque `hover-elevate` já cobre o hover — manter os dois juntos não quebra nada, mas é redundante. `hover:text-foreground` no `ghost` fica porque é mudança de cor de texto, que o sistema de elevação não faz.)

- [ ] **Step 2: Atualizar os botões de ícone do `AlertRow`**

Estado atual (linhas ~579 e ~583):

```tsx
          <button onClick={onRead} className="rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label={alert.status === 'unread' ? 'Marcar como lido' : 'Marcar como não lido'} data-testid={`button-read-${alert.id}`}>
```
```tsx
            <button onClick={() => setMenuOpen(o => !o)} className="rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label="Mais opções" data-testid={`button-more-${alert.id}`}>
```

Substituir cada `hover:bg-accent` por `hover-elevate active-elevate`:

```tsx
          <button onClick={onRead} className="rounded-md p-2 text-muted-foreground hover-elevate active-elevate" aria-label={alert.status === 'unread' ? 'Marcar como lido' : 'Marcar como não lido'} data-testid={`button-read-${alert.id}`}>
```
```tsx
            <button onClick={() => setMenuOpen(o => !o)} className="rounded-md p-2 text-muted-foreground hover-elevate active-elevate" aria-label="Mais opções" data-testid={`button-more-${alert.id}`}>
```

Também os dois botões dentro do menu dropdown (linhas ~588-593 e ~596-601) — trocar `hover:bg-accent` por `hover-elevate active-elevate` no botão "Copiar mensagem", e `hover:bg-destructive/10` por `hover-elevate active-elevate` no botão "Remover alerta" (o overlay funciona igual sobre o fundo `text-destructive`).

- [ ] **Step 3: Repetir o mesmo padrão nos demais botões de ícone `hover:bg-accent` do arquivo**

Buscar por `hover:bg-accent` no arquivo inteiro (`grep -n "hover:bg-accent" artifacts/signalwatch/src/App.tsx`) e trocar cada ocorrência restante — sino de notificações no header, botão de fechar do `NotificationPanel`, botões de editar/pausar/excluir em `RulesPage`, botão de fechar do `RuleModal` — pelo mesmo par `hover-elevate active-elevate`. São variações do mesmo padrão `rounded-* p-* text-muted-foreground hover:bg-accent`; cada uma vira `rounded-* p-* text-muted-foreground hover-elevate active-elevate`.

- [ ] **Step 4: Typecheck**

Run: `cd /home/kali/signalwatch && npx tsc --noEmit -p artifacts/signalwatch/tsconfig.json`
Expected: zero erros.

- [ ] **Step 5: Verificação visual manual**

No celular (ou emulando touch no DevTools), tocar e segurar o botão de três pontinhos, o sino de notificação e os botões de editar/pausar regra — confirmar que cada um escurece/clareia visivelmente durante o toque, não só quando o mouse passa por cima.

- [ ] **Step 6: Commit**

```bash
cd /home/kali/signalwatch
git add artifacts/signalwatch/src/App.tsx
git commit -m "Wire up hover-elevate/active-elevate on every interactive button

The elevation overlay system (--elevate-1/--elevate-2, .hover-elevate,
.active-elevate) already existed in index.css but was never applied
to any component — every button relied on :hover alone, which mobile
touch doesn't reliably trigger. This is the root cause of the
'transparent on click' report on the alert row's more-options button,
and affected every icon button in the app the same way."
```

---

## Task 3: Paleta da marca no componente `Pill`

**Files:**
- Modify: `artifacts/signalwatch/src/App.tsx:206-215`

**Interfaces:**
- Consumes: nada.
- Produces: `Pill` continua com a mesma assinatura (`tone: 'teal' | 'amber' | 'red' | 'slate' | 'blue'`) — nenhum call site precisa mudar, só as cores por trás de cada `tone`.

- [ ] **Step 1: Ler o estado atual**

```tsx
function Pill({ children, tone = 'teal' }: { children: ReactNode; tone?: 'teal' | 'amber' | 'red' | 'slate' | 'blue' }) {
  const colors = {
    teal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    slate: 'bg-muted text-muted-foreground dark:bg-muted/80',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${colors[tone]}`}>{children}</span>;
}
```

- [ ] **Step 2: Substituir pela paleta da marca**

`teal` (hoje usado para "ativo/conectado/positivo") vira o laranja da marca via os tokens já existentes (`accent`/`accent-foreground`, que em ambos os temas já são derivados do laranja — ver `index.css`). `amber` (atenção) fica num tom âmbar mas mais próximo da família quente. `red` (erro/destrutivo) usa os tokens `destructive` já existentes em vez de vermelho genérico do Tailwind. `slate` (neutro/pausado) e `blue` (informativo neutro) seguem em tons neutros — não há laranja "informativo" na paleta, e forçar isso ficaria estranho, então ficam em cinza/muted, consistente com o resto do design system:

```tsx
function Pill({ children, tone = 'teal' }: { children: ReactNode; tone?: 'teal' | 'amber' | 'red' | 'slate' | 'blue' }) {
  const colors = {
    teal: 'bg-accent text-accent-foreground',
    amber: 'bg-secondary text-secondary-foreground',
    red: 'bg-destructive/10 text-destructive',
    slate: 'bg-muted text-muted-foreground',
    blue: 'bg-muted text-muted-foreground',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${colors[tone]}`}>{children}</span>;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd /home/kali/signalwatch && npx tsc --noEmit -p artifacts/signalwatch/tsconfig.json`
Expected: zero erros.

- [ ] **Step 4: Verificação visual manual**

Abrir `/app/rules` (badge "Ativa"/"Pausada"), `/app/connection` (badge de status) e `/app/alerts` (badge "internos") em ambos os temas — confirmar que os badges agora usam tons de laranja/neutro da marca, não mais verde/âmbar/vermelho genéricos do Tailwind, e que o contraste de texto continua legível.

- [ ] **Step 5: Commit**

```bash
cd /home/kali/signalwatch
git add artifacts/signalwatch/src/App.tsx
git commit -m "Use brand palette in Pill instead of generic Tailwind colors

Status badges (rule active/paused, connection status, etc.) used
stock Tailwind emerald/amber/red/blue instead of the warm orange
palette already established everywhere else in the design system."
```

---

## Task 4: Corrigir os placeholders do formulário de regra (`RuleModal`)

**Files:**
- Modify: `artifacts/signalwatch/src/App.tsx` — dentro de `RuleModal`, por volta da linha 672

**Interfaces:**
- Consumes: nenhuma.
- Produces: nenhuma — só texto estático.

Este é o ajuste mais urgente da spec: os placeholders atuais ("licitação, cotação, fornecedor", "Ex: Expansão no interior", "curso, vaga") são resíduo do posicionamento B2B antigo e não batem com nenhum dos 4 casos de uso reais. Troca para o exemplo carro-chefe (eletrônicos/celulares), que é o caso de uso validado e o mais fácil de qualquer usuário reconhecer instantaneamente.

- [ ] **Step 1: Trocar o placeholder do nome da regra**

Buscar `placeholder="Ex: Expansão no interior"` e substituir por:

```tsx
placeholder="Ex: Promoção de iPhone"
```

- [ ] **Step 2: Trocar o placeholder de palavras-chave**

Buscar `placeholder="licitação, cotação, fornecedor"` e substituir por:

```tsx
placeholder="iphone, galaxy s24, ps5"
```

- [ ] **Step 3: Trocar o placeholder de exclusão**

Buscar `placeholder="curso, vaga"` e substituir por:

```tsx
placeholder="usado, seminovo, capa"
```

- [ ] **Step 4: Typecheck**

Run: `cd /home/kali/signalwatch && npx tsc --noEmit -p artifacts/signalwatch/tsconfig.json`
Expected: zero erros.

- [ ] **Step 5: Verificação visual manual**

Abrir `/app/rules`, clicar em "Nova regra" e confirmar que os três campos mostram os novos placeholders quando vazios.

- [ ] **Step 6: Commit**

```bash
cd /home/kali/signalwatch
git add artifacts/signalwatch/src/App.tsx
git commit -m "Replace RuleModal placeholders with the flagship use case

The old placeholders (licitação, cotação, fornecedor) were leftover
B2B-procurement copy that matched none of the 4 confirmed use cases.
Now shows the electronics/phones example — the validated, most
broadly recognizable one."
```

---

## Task 5: Copy do Dashboard

**Files:**
- Modify: `artifacts/signalwatch/src/App.tsx` — dentro de `DashboardContent`, por volta da linha 619 e 626

**Interfaces:**
- Consumes: nenhuma.
- Produces: nenhuma.

- [ ] **Step 1: Trocar a descrição do cabeçalho**

Buscar:

```tsx
description="Seu radar está de olho. Aqui está o que merece atenção agora."
```

Substituir por (concreto, sem adjetivo vago):

```tsx
description="Alertas capturados nas últimas 24 horas, prontos pra você revisar."
```

- [ ] **Step 2: Trocar o título do estado vazio**

Buscar `title="Nenhum sinal ainda"` (linha ~626) — o `body` que já acompanha ("Quando uma mensagem cruzar suas regras, ela aparecerá neste espaço.") já é concreto e fica como está. Só ajustar o título para reforçar ação, não estado passivo:

```tsx
title="Ainda sem alertas"
```

- [ ] **Step 3: Typecheck**

Run: `cd /home/kali/signalwatch && npx tsc --noEmit -p artifacts/signalwatch/tsconfig.json`
Expected: zero erros.

- [ ] **Step 4: Verificação visual manual**

Abrir `/app` (dashboard) e conferir a nova descrição no cabeçalho. Se a conta de teste não tiver alertas, conferir o novo título do estado vazio na seção "Sinais recentes".

- [ ] **Step 5: Commit**

```bash
cd /home/kali/signalwatch
git add artifacts/signalwatch/src/App.tsx
git commit -m "Rewrite dashboard header/empty-state copy to be concrete"
```

---

## Task 6: Copy da página de Alertas

**Files:**
- Modify: `artifacts/signalwatch/src/App.tsx` — dentro de `AlertsPage`, por volta da linha 660

**Interfaces:**
- Consumes: nenhuma.
- Produces: nenhuma.

- [ ] **Step 1: Trocar a descrição do cabeçalho**

Buscar:

```tsx
description="Oportunidades filtradas das conversas que você não tem tempo de acompanhar."
```

Substituir por:

```tsx
description="Cada mensagem que bateu com uma das suas regras, na ordem em que chegou."
```

- [ ] **Step 2: Trocar o título do estado "nada encontrado"**

Buscar `title="Nada cruzou esse filtro"` — já é uma frase boa e concreta, fica como está. O `body` ("Tente outra palavra ou amplie o período para encontrar um sinal.") também fica.

- [ ] **Step 3: Typecheck**

Run: `cd /home/kali/signalwatch && npx tsc --noEmit -p artifacts/signalwatch/tsconfig.json`
Expected: zero erros.

- [ ] **Step 4: Verificação visual manual**

Abrir `/app/alerts` e conferir a nova descrição no cabeçalho.

- [ ] **Step 5: Commit**

```bash
cd /home/kali/signalwatch
git add artifacts/signalwatch/src/App.tsx
git commit -m "Rewrite alerts page header copy to be concrete"
```

---

## Task 7: Passe leve de consistência — Grupos, Conexão, Billing, Configurações

**Files:**
- Modify: `artifacts/signalwatch/src/App.tsx` — linhas ~706, ~832-834, ~1010, ~1119

**Interfaces:**
- Consumes: nenhuma.
- Produces: nenhuma.

Estas quatro páginas já estão em tom aceitável (a spec marcou como prioridade baixa) — o ajuste aqui é só remover a única palavra genérica remanescente em cada uma, sem reescrever as frases inteiras.

- [ ] **Step 1: Grupos — nenhuma mudança de texto necessária**

Ler a descrição atual: `description="Todo grupo e canal autorizado é monitorado automaticamente — use as regras para decidir o que vira sinal."` — já é concreta e específica (explica o mecanismo real). Confirmar que segue assim, sem editar.

- [ ] **Step 2: Conexão — nenhuma mudança de texto necessária**

Ler a descrição atual: `description="Uma sessão pessoal e protegida para ler os grupos que você escolheu. O ViaX: Trace nunca pede sua senha."` — já é concreta (menciona a garantia de segurança real). Confirmar que segue assim, sem editar.

- [ ] **Step 3: Billing — trocar "sinais" isolado por linguagem consistente com os 4 casos de uso**

Buscar:

```tsx
description="Mais cobertura para encontrar os sinais que pagam a conta — sem surpresas no cartão."
```

Substituir por:

```tsx
description="Mais grupos monitorados, mais regras ativas — sem surpresas no cartão."
```

- [ ] **Step 4: Configurações — nenhuma mudança de texto necessária**

Ler a descrição atual: `description="Controle de conta, segurança, privacidade e preferências da operação."` — já é concreta e funcional. Confirmar que segue assim, sem editar.

- [ ] **Step 5: Typecheck**

Run: `cd /home/kali/signalwatch && npx tsc --noEmit -p artifacts/signalwatch/tsconfig.json`
Expected: zero erros.

- [ ] **Step 6: Verificação visual manual**

Abrir `/app/billing` e conferir a nova descrição.

- [ ] **Step 7: Commit**

```bash
cd /home/kali/signalwatch
git add artifacts/signalwatch/src/App.tsx
git commit -m "Light copy consistency pass on billing page description"
```

---

## Task 8: Landing page — headline e seletor de casos de uso

**Files:**
- Modify: `artifacts/signalwatch/src/pages/Landing.tsx`

**Interfaces:**
- Consumes: nenhuma.
- Produces: nenhuma — mudança isolada dentro do componente `Landing`, sem exportar nada novo.

O restante da landing (seções "Fluxo operacional", "Diferenciais", "Conformidade", "Documentação") já é redigido de forma genérica o bastante para servir qualquer um dos 4 casos de uso — não precisa de edição. Esta tarefa cobre só o hero (que hoje fala especificamente de "promoções" no sentido de e-commerce) e o mock de "Capturas recentes" (que hoje é fixo em iPhone/PS5/Samsung sem dar ao visitante a chance de se identificar com o próprio caso de uso).

- [ ] **Step 1: Trocar a badge e o headline do hero**

Estado atual (linhas ~53-61):

```tsx
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e8531a]/20 bg-[#fee8da] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.15em] text-[#c43e12]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e8531a]" />
              Captura de promoções · Tempo real
            </div>

            <h1 className="max-w-lg text-[2.9rem] font-bold leading-[1.06] tracking-[-0.055em] text-foreground lg:text-[3.9rem]">
              Capture promoções antes que<br />
              <span className="text-[#e8531a]">todo mundo veja.</span>
            </h1>
```

Substituir por:

```tsx
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e8531a]/20 bg-[#fee8da] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.15em] text-[#c43e12]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e8531a]" />
              Alertas automáticos · Grupos do Telegram
            </div>

            <h1 className="max-w-lg text-[2.9rem] font-bold leading-[1.06] tracking-[-0.055em] text-foreground lg:text-[3.9rem]">
              Ache a mensagem certa,<br />
              <span className="text-[#e8531a]">no grupo certo, na hora certa.</span>
            </h1>
```

- [ ] **Step 2: Trocar o parágrafo de apoio do hero**

Estado atual (linha ~63-65):

```tsx
            <p className="mt-6 max-w-md text-[0.95rem] leading-[1.85] text-muted-foreground">
              ViaX: Trace monitora grupos do Telegram pela palavra-chave que você definiu. Quando uma promoção aparece, você é o primeiro a saber — com controle total sobre o que é monitorado.
            </p>
```

Substituir por:

```tsx
            <p className="mt-6 max-w-md text-[0.95rem] leading-[1.85] text-muted-foreground">
              ViaX: Trace monitora os grupos e canais do Telegram que você escolher e avisa assim que a palavra-chave certa aparecer — como um Google Alerts, só que pra dentro dos grupos que o Google não enxerga.
            </p>
```

- [ ] **Step 3: Adicionar o array de casos de uso e o estado de seleção**

Estado atual (linhas ~21-25, logo acima de `export default function Landing()`):

```tsx
const PREVIEW_ALERTS = [
  { id: 'a-1', groupName: 'Promos Eletrônicos BR', message: 'iPhone 15 Pro Max 256GB por R$4.299 — loja parceira, frete grátis SP/RJ.', keyword: 'iphone' },
  { id: 'a-2', groupName: 'Ofertas Games 🎮', message: 'PS5 Slim + controle extra R$2.890 à vista. Estoque limitado, entrega imediata.', keyword: 'ps5' },
  { id: 'a-3', groupName: 'Cupons & Cashback', message: 'Samsung Galaxy S24 com 30% de desconto + 10% cashback via Pix no app.', keyword: 'samsung' },
];
```

Substituir por:

```tsx
const USE_CASES = [
  {
    id: 'eletronicos',
    label: 'Eletrônicos & celulares',
    alerts: [
      { id: 'a-1', groupName: 'Promos Eletrônicos BR', message: 'iPhone 15 Pro Max 256GB por R$4.299 — loja parceira, frete grátis SP/RJ.', keyword: 'iphone' },
      { id: 'a-2', groupName: 'Ofertas Games 🎮', message: 'PS5 Slim + controle extra R$2.890 à vista. Estoque limitado, entrega imediata.', keyword: 'ps5' },
      { id: 'a-3', groupName: 'Cupons & Cashback', message: 'Samsung Galaxy S24 com 30% de desconto + 10% cashback via Pix no app.', keyword: 'samsung' },
    ],
  },
  {
    id: 'imoveis',
    label: 'Imóveis',
    alerts: [
      { id: 'b-1', groupName: 'Repasses SP Capital', message: 'Repasse apto 2 dorm Vila Mariana, R$620mil, direto com proprietário, sem comissão.', keyword: 'repasse' },
      { id: 'b-2', groupName: 'Lançamentos Zona Sul', message: 'Lançamento 3 dorm Moema, tabela de pré-lançamento até sexta, entrada facilitada.', keyword: 'lançamento' },
      { id: 'b-3', groupName: 'Corretores Parceiros RJ', message: 'Cobertura Barra da Tijuca, 4 suítes, abaixo da tabela por urgência do proprietário.', keyword: 'cobertura' },
    ],
  },
  {
    id: 'vagas',
    label: 'Vagas & oportunidades',
    alerts: [
      { id: 'c-1', groupName: 'Vagas Tech Remoto', message: 'Vaga dev backend pleno, remoto, CLT, R$9-12k. Envie currículo até amanhã.', keyword: 'backend' },
      { id: 'c-2', groupName: 'Empregos SP Zona Norte', message: 'Contratação imediata operador de logística, turno tarde, vale-transporte incluso.', keyword: 'logística' },
      { id: 'c-3', groupName: 'Freelas & PJ Design', message: 'Preciso de designer freelancer pra identidade visual, prazo 2 semanas, orçamento aberto.', keyword: 'freelancer' },
    ],
  },
  {
    id: 'licitacoes',
    label: 'Licitações & fornecedores',
    alerts: [
      { id: 'd-1', groupName: 'Editais Compras Públicas', message: 'Pregão eletrônico aberto: fornecimento de material de escritório, prazo de proposta dia 28.', keyword: 'pregão' },
      { id: 'd-2', groupName: 'Cotações B2B Brasil', message: 'Empresa busca cotação de embalagens personalizadas, volume 10mil un/mês.', keyword: 'cotação' },
      { id: 'd-3', groupName: 'Rede de Fornecedores SP', message: 'Chamada de fornecedor de matéria-prima têxtil, entrega recorrente mensal.', keyword: 'fornecedor' },
    ],
  },
];
```

- [ ] **Step 4: Tornar `Landing` um componente com estado e adicionar os botões de seleção**

`Landing` hoje é `export default function Landing() { return ( ... ) }` sem nenhum `useState`. Adicionar o import de `useState` no topo do arquivo (linha 2, junto com o import existente):

```tsx
import { useState } from 'react';
import { BookOpen, ChevronRight, FileText, Lock, Scale, ShieldCheck, Target, Terminal, Zap } from 'lucide-react';
```

Dentro de `export default function Landing() {`, antes do `return`, adicionar:

```tsx
export default function Landing() {
  const [activeCase, setActiveCase] = useState(0);
  return (
```

- [ ] **Step 5: Adicionar a barra de seleção de casos de uso e trocar o mock pra usar o caso ativo**

Estado atual do bloco "Mock dashboard" (linhas ~96-97, logo antes do card):

```tsx
          {/* Mock dashboard */}
          <div className="relative">
```

Substituir por (adiciona a barra de tabs acima do card mockado):

```tsx
          {/* Mock dashboard */}
          <div className="relative">
            <div className="mb-4 flex flex-wrap gap-2">
              {USE_CASES.map((useCase, i) => (
                <button
                  key={useCase.id}
                  onClick={() => setActiveCase(i)}
                  className={`hover-elevate active-elevate rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${
                    i === activeCase
                      ? 'border-[#e8531a] bg-[#e8531a] text-white'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                  data-testid={`button-usecase-${useCase.id}`}
                >
                  {useCase.label}
                </button>
              ))}
            </div>
```

Em seguida, dentro do mesmo card, trocar a referência a `PREVIEW_ALERTS.map(...)` (linha ~138) por `USE_CASES[activeCase].alerts.map(...)`:

```tsx
                    <div className="mt-3 space-y-2.5">
                      {USE_CASES[activeCase].alerts.map((a, i) => (
```

(o resto do `.map` — `key={a.id}`, o conteúdo de cada card — fica exatamente igual, só a fonte dos dados muda.)

- [ ] **Step 6: Typecheck**

Run: `cd /home/kali/signalwatch && npx tsc --noEmit -p artifacts/signalwatch/tsconfig.json`
Expected: zero erros. Se aparecer erro de `PREVIEW_ALERTS` não definido, confirmar que todas as referências antigas foram trocadas por `USE_CASES[activeCase].alerts`.

- [ ] **Step 7: Verificação visual manual**

Abrir `http://localhost:21188/` (deslogado — a landing só aparece pra visitante sem sessão), conferir o novo headline, e clicar em cada uma das 4 abas de caso de uso confirmando que o mock à direita troca os 3 exemplos de mensagem. Testar também em viewport mobile (largura ~390px) — as abas devem quebrar linha (`flex-wrap`) sem cortar texto.

- [ ] **Step 8: Commit**

```bash
cd /home/kali/signalwatch
git add artifacts/signalwatch/src/pages/Landing.tsx
git commit -m "Rewrite landing hero and add use-case selector

Hero copy no longer locks the product into 'promoções' e-commerce
framing. The static PREVIEW_ALERTS mock (always iPhone/PS5/Samsung)
becomes an interactive 4-category selector — electronics/phones
(flagship), real estate, jobs, and public bids/suppliers — so a
visitor from any of the 4 target audiences sees their own example
instead of always defaulting to phones."
```

---

## Self-Review Notes

- **Spec coverage:** todos os itens do Bloco 1 (posicionamento/headline), Bloco 2 (copy por página) e Bloco 3 (visual/UI) da spec têm task correspondente. A extensão de textura `vx-grid`/`vx-noise` mencionada na spec foi verificada durante o planejamento e já está aplicada em todos os wrappers de página relevantes (`sw-noise` no `AppShell` e nas páginas de auth) — não há gap real para fechar, então nenhuma task foi criada para isso; a spec estava certa no espírito mas a premissa específica ("só 5 pontos") já é satisfeita pela cobertura atual.
- **Placeholder scan:** nenhum "TBD"/"TODO" — todo passo tem código real, toda copy tem o texto final exato.
- **Type consistency:** `Pill` mantém a mesma assinatura de `tone` em todo o arquivo; `USE_CASES[activeCase].alerts` produz o mesmo formato de objeto (`id`, `groupName`, `message`, `keyword`) que `PREVIEW_ALERTS` tinha, então o `.map` que consome esses dados não muda de forma.
