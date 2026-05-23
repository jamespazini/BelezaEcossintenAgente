# TODO - Finalizar integração REAL Agent IA -> WhatsApp (Beleza Ecosystem)

## Passos
1. [x] Revisar/ajustar `actions.service.js` (sanitização, validação E.164, LGPD logs sem stack trace).
2. [x] Propagar `correlationId` (traceId alias) no fluxo agent->actions->queue job data/logs.
3. [ ] Implementar idempotência segura (dedupe) sem duplicar sistema.
4. [ ] Hardening multi-tenant (garantir tenantId válido e evitar override em payloads/callbacks).
5. [x] Atualizar/robustecer testes existentes para refletir sanitização E.164 e correlationId.
6. [ ] Rodar `backend` tests e lint + corrigir quebras.
7. [ ] Atualizar `RELATORIO_INTEGRACAO_FINAL.md` com arquivos alterados, decisões e validações.

