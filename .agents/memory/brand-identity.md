---
name: ViaX Trace brand identity
description: Nome, paleta de cores, logo e design system do projeto ViaX Trace (antigo SignalWatch).
---

## Nome
- **Plataforma**: ViaX: Trace
- **Descrição**: Legacy focado em captura de promoções em grupos do Telegram via palavra-chave. Controle, visão e administração total.

## Logo
- Estilo: fundo branco com cantos arredondados (rx=9), curva bezier grossa preta (#0f0f0f) ligando círculo preenchido (topo-esquerda) a ring/donut laranja (baixo-direita)
- Curva/ponto preenchido: `#0f0f0f`
- Ring (donut): `#e8531a` (laranja brand)
- Fundo: `#ffffff` com borda sutil `#e8e5df`
- Fonte do wordmark: ViaX (11px, uppercase, tracking .22em, orange) + Trace (16px bold)

## Paleta de cores
| Papel | Hex | Uso |
|---|---|---|
| Background | `#f4f3ef` | Página principal (paper/linho quente) |
| Sidebar | `#0f0f0f` | Near-black, sidebar e elementos escuros |
| Brand/Primary | `#e8531a` | Laranja — botões, badges, accents |
| Brand Hover | `#d44517` | Laranja mais escuro |
| Brand Dark | `#c43e12` | Laranja muito escuro (texto sobre fundo claro) |
| Card | `#ffffff` | Fundo dos cards |
| Border light | `#e4e1db` | Borda de elementos (warm gray) |
| Border medium | `#e0dcd5` | Bordas médias |
| Text primary | `#0f0f0f` | Texto principal |
| Text muted | `#6b6560` | Texto secundário |
| Text faint | `#9a9490` | Texto fraco/hint |
| Surface light | `#fafaf8` | Backgrounds alternativos |
| Accent tint | `#fee8da` | Background laranja suave (ícones, badges) |
| Accent medium | `#fde8d4` | Laranja médio |
| Sidebar fg | `#e8e5e0` | Texto claro sobre sidebar dark |

## Design system
- **Fonte**: Poppins (400/500/600/700/800) + DM Mono
- **CSS classes**: `vx-display`, `vx-card`, `vx-noise`, `vx-transition`, `vx-fade-up` (antigos `sw-` ainda funcionam como alias)
- **Referência visual**: repositório github.com/ViaXTrace/Viax-Trace — design baseado no viax-scout (fundo quente #f4f3ef, sidebar escura, acento laranja)
- **Sidebar near-black**: `#0f0f0f` bg, hover `#252525`, active `#1c1c1c`
- **Botão primary**: `bg-[#e8531a] hover:bg-[#d44517] shadow orange`
- **Botão secondary**: `border-[#e0dcd5] bg-[#fffcfa] text-[#c43e12] hover:bg-[#fae6d8]`

## Clerk appearance
- colorPrimary: `#e8531a`
- colorBackground: `#f4f3ef`
- colorForeground: `#0f0f0f`
- formButtonPrimary: `bg-[#e8531a] hover:bg-[#d44517]`
- footerActionLink: `text-[#e8531a]`

## **Why:**
Rebrand solicitado pelo usuário: produto descontinuado ViaX Trace era do mesmo autor. O design system do Trace (warm off-white + orange accent + near-black) foi extraído do repositório público github.com/ViaXTrace/Viax-Trace/artifacts/viax-scout.
