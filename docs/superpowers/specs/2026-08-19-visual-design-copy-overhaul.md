# Revisão de design visual e copy — ViaX: Trace

**Data:** 2026-08-19
**Status:** Aprovado para planejamento de implementação

## Contexto

O produto foi construído em passes anteriores (parcialmente por outro agente) sem um
posicionamento único. Auditoria do código encontrou:

1. A landing page (`src/pages/Landing.tsx`, pública, indexável pelo Google) vende
   "capture promoções antes de todo mundo" com exemplos de e-commerce genérico
   (iPhone, PS5, Samsung).
2. O app autenticado (`src/App.tsx`) usa exemplos e vocabulário de monitoramento B2B
   ("licitação, cotação, fornecedor", "Expansão no interior") nos placeholders do
   formulário de regras — sem relação com o que a landing promete.
3. Boa parte do copy do app é genérico/vago ("Oportunidades filtradas das conversas
   que você não tem tempo de acompanhar") — não comunica nada concreto.
4. Dois problemas visuais sistêmicos:
   - Os tokens de sombra do CSS (`--shadow-sm` até `--shadow-2xl` em
     `src/index.css`) estão todos definidos como `rgba(0,0,0,0)` — totalmente
     transparentes, sobra de um template shadcn nunca customizado. Isso deixa 7
     superfícies flutuantes sem sombra (menu de "mais opções" dos alertas, painel
     de notificações, cartão de login, modal de regras, cartão de QR code, entre
     outras).
   - Nenhum botão do app (nem o componente `Button` compartilhado, nem os
     ~12 botões de ícone) tem estado `active:` — só `hover:`, que não existe de
     forma confiável em toque de celular. Resultado: cliques não dão feedback
     visual algum (a queixa original de "fundo transparente" no menu de três
     pontinhos).
   - O componente `Pill` (badges de status, usado 8x) usa paleta genérica do
     Tailwind (verde/âmbar/vermelho) em vez da paleta laranja da marca.

## Decisão de posicionamento

Conversa com o dono do produto (registrado aqui pra não se perder):

- O cliente original pediu uma ferramenta pra encontrar automaticamente promoções
  de **celular** especificas em ~300 grupos de Telegram — esse é o caso de uso que
  provou o conceito.
- Vender só esse nicho limita demais o número de assinantes possíveis.
- Decisão: o **produto** continua genérico (monitoramento configurável de
  qualquer grupo/canal do Telegram por palavra-chave), mas o **marketing/copy**
  se ancora numa analogia de categoria fácil de entender —
  **"tipo Google Alerts, só que pra grupos do Telegram"** — e mostra 4 casos de
  uso concretos, cada um servindo de âncora de SEO e de prova de que a ferramenta
  funciona de verdade, não é só "genérica e vaga":

  1. **Eletrônicos & celulares** — carro-chefe, caso de uso original e validado
  2. **Imóveis** — repasses e lançamentos em grupos de corretores
  3. **Vagas & oportunidades de trabalho** — vagas que circulam antes do LinkedIn
  4. **Licitações & fornecedores** — editais e chamadas de cotação (já existia,
     sem querer, nos placeholders atuais — formaliza o que já estava lá)

## Escopo

### 1. Landing page (`src/pages/Landing.tsx`)
- Headline ancorada na categoria ("Alertas automáticos para qualquer grupo do
  Telegram"), subtítulo concreto sobre o resultado (não sobre a tecnologia).
- Seção de "como funciona" e "diferenciais" mantêm a estrutura atual (já é sólida
  e bem escrita) — só ajustar copy pontual pra remover qualquer resquício
  "e-commerce genérico".
- Trocar o mock de alertas (`PREVIEW_ALERTS`, hoje iPhone/PS5/Samsung genéricos)
  por um seletor/abas com os 4 casos de uso, um exemplo de mensagem real por
  categoria.
- Manter a seção de conformidade/privacidade como está (já é um diferencial
  forte e bem argumentado).

### 2. Copy dentro do app (`src/App.tsx`)
Página a página, substituir texto vago por texto concreto e orientado a ação/
resultado. Prioridade:
- **Formulário de regra (`RuleModal`)** — mais urgente: placeholders hoje
  contradizem os 4 casos de uso reais. Trocar para o exemplo carro-chefe
  (celular/eletrônicos): nome "Ex: Promoção de iPhone", palavras-chave
  "iphone, galaxy s24, ps5", exclusão "usado, seminovo, capa".
- **Dashboard** (`DashboardContent`) — trocar a descrição vaga por algo que
  puxe um dado concreto (contagem de grupos/alertas).
- **Alertas** (`AlertsPage`) — mesma lógica: descrição concreta, sem a palavra
  "oportunidades" solta sem contexto.
- **Grupos, Conexão, Billing, Configurações** — já em tom aceitável; passe leve
  de consistência de voz, não reescrita completa.
- Regra de voz pra todo o copy novo: frases curtas, verbo de ação + resultado
  mensurável, zero adjetivo vago ("eficiente", "poderoso", "oportunidades").

### 3. Correções visuais/UI (aplicam em mobile e desktop)
- **Sombras**: dar valores reais aos tokens `--shadow-sm` até `--shadow-2xl`
  em `src/index.css` (light e dark mode), consistentes com a paleta quente
  já estabelecida — não reinventar, só preencher o que está zerado.
- **Estado de clique/toque**: adicionar `active:` (e reforçar `focus-visible:`)
  em todo botão interativo — começando pelo componente `Button` compartilhado
  e pelos botões de ícone (`AlertRow`, notificações, etc.), que é onde a queixa
  original apareceu.
- **`Pill`**: trocar a paleta genérica do Tailwind pela paleta da marca
  (tons de laranja/`--primary`, mais um tom neutro pro estado "pausado/inativo"),
  mantendo os mesmos significados semânticos que já existem hoje.
- **Textura de continuidade**: estender `vx-grid`/`vx-noise` (já usado na
  landing e em 5 pontos do app) pra mais uma ou duas superfícies-chave do app
  pra reforçar que landing e app são o mesmo produto — sem exagerar, é um
  toque sutil que já existe, não uma textura nova.

### Fora de escopo (explicitamente, pra não crescer o pedido)
- Nenhuma mudança de funcionalidade, fluxo de dados ou lógica de backend além
  do que já foi corrigido na rodada anterior (contadores).
- Nenhuma nova página, seção ou feature.
- Reestruturação de arquitetura de informação (menu, rotas) — só copy e visual
  dentro da estrutura atual.
- E-mails transacionais, se existirem, ficam pra uma rodada futura.

## Critério de sucesso
- Landing e app contam a mesma história de produto (categoria + casos de uso),
  sem contradição de exemplos.
- Todo texto de UI auditado nesta rodada (ver lista acima) troca adjetivo vago
  por resultado concreto.
- As 7 superfícies flutuantes identificadas têm sombra visível; todo botão
  interativo tem feedback visual perceptível em toque (não só mouse hover).
- `Pill` usa exclusivamente tons da paleta da marca.
