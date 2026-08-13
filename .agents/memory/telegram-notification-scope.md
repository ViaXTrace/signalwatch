---
name: Telegram notification scope
description: Product decision about how Telegram is used and where alerts are delivered.
---

O produto usa o Telegram somente para autorizar a conta pessoal do cliente via QR Code e ler mensagens dos grupos escolhidos. Não haverá bot oficial, Bot API, token de bot ou notificações enviadas pelo Telegram; os alertas serão exibidos exclusivamente no SaaS.

**Why:** Essa decisão reduz a complexidade operacional, remove a necessidade de manter um bot central e concentra a experiência, o histórico e o controle de alertas no produto próprio.

**How to apply:** Manter o conector MTProto isolado do SaaS. A sessão pessoal continua sendo dado sensível, deve ser criptografada, isolada por organização, revogável e nunca exposta ao frontend, logs ou usuário. Usar atualização em tempo real dentro do SaaS quando possível; declarar claramente qualquer limitação de recebimento de eventos.