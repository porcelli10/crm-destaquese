# Registro do dia — 2026-07-09

Resumo de tudo que foi construído e implantado hoje no CRM (Destaque-se / iaSolution).
Guarde este arquivo como referência para continuar depois.

---

## 1. Idioma padrão pt-BR
- O painel agora **inicia em português** (antes caía para inglês).
- Arquivos: `frontend/src/translate/i18n.js`, `LanguageControl`, `calendar-locale.js`, `App.js`.

## 2. Templates no canal iaSolution
- **Enviar template** (dentro do atendimento e para número novo), listar, **Sincronizar** (busca da Meta) e **Criar template** pela plataforma.
- Endpoints do CRM reaproveitados (`/official-templates/*`) agora atendem `official` **e** `iasolution`.
- API do Hub usada: `GET /templates`, `POST /templates/sync`, `POST /templates`, `POST /messages/template`.

## 3. Kanban — reconstrução completa (referência "FixIA")
- **Aparência do card configurável** (⚙ na toolbar): agendamentos, responsável+fila, tempo de espera, tags+canal, campos personalizados, última mensagem. Config por empresa (Setting `kanbanCardFields`).
- **Valor do negócio** por card (editável) + **Total R$** e **contagem** por coluna + borda colorida.
- **Menu ⋮ por coluna**: Editar coluna, Baixar CSV, Duplicar coluna. Modal **"Configurações da Coluna"** (abas Gerais / Automações / Integrações).
- **Campos personalizados** no card (máx. 2, "+N · clique para ver"); **clique no card abre modal de detalhes** com resumo completo + adicionar/editar/remover campos.
- **Reordenar colunas** (arrastar o cabeçalho — salva a ordem; campo `Tags.position`).
- **Soltar card em qualquer parte da coluna** (drop-zone preenche a coluna).
- **Card não some mais** ao sair de coluna: "Aberto" mostra tickets sem tag de **coluna** (ignora tags comuns).

### Motor de automação por coluna
- Modal "Nova Automação" (multi-gatilho / multi-ação, intervalo, horário, ativo).
- **Gatilhos que funcionam:** Entrada no Card, Saída do Card, Tempo na Coluna, Sem Interação.
- **Ações que funcionam:** Enviar Mensagem, Enviar Template, Mudar de Coluna, Adicionar/Remover Tag, Vincular Responsável, Criar Atividade, Aguardar (Delay).
- Gatilhos "em breve" ainda listados: Execução recorrente, Tempo Recorrente na Coluna, Mensagem Recebida.
- Ações "em breve" **removidas** do builder (Funil, Criativo, Agente de IA, Duplicar Negócio, Disparar Conversão).
- Monitor Bull a cada 30 min processa as automações por tempo.

## 4. Tempo real (socket) do Kanban
- O Kanban **não tinha listener de socket** — só atualizava ao recarregar. Agora escuta `company-ticket`, `company-appMessage`, `tag` (com debounce).
- Mudanças de tag emitem atualização do ticket (`EmitTicketUpdate`) → **lista de atendimentos e Kanban** atualizam sem recarregar.

## 5. Performance de deploy
- Dockerfiles reordenados para **cachear `yarn install`** (instala deps antes de copiar o código).
- Tempos: **só backend ~1-2 min**, backend+frontend ~5-6 min, só frontend ~4-5 min.
- Gargalo restante: `yarn build` do CRA (~2 min). Opção futura: migrar para **Vite**.

---

## 6. APIs externas (autenticadas pelo TOKEN DA CONEXÃO)

Todas usam header `Authorization: Bearer <TOKEN DA CONEXÃO>` (tela de **Conexões**).
Base: `https://apicrm.destaqueseagora.com.br`

| Ação | Método | Rota | Body / Query |
|---|---|---|---|
| Adicionar tag | POST | `/api/tags/add` | `{ number, tag, color? }` |
| Remover tag | POST | `/api/tags/remove` | `{ number, tag }` |
| Campos do card | POST | `/api/kanban/custom-fields` | `{ number\|ticketId, fields }` (obj ou array) |
| Mover card de coluna | POST | `/api/kanban/move` | `{ number\|ticketId, column\|tagId }` |
| Consultar lead | GET | `/api/kanban/lead` | `?number=...` ou `?ticketId=...` → `{ id, column, number, name }` |
| Enviar mensagem | POST | `/api/messages/send` | `{ number, body }` (ou multipart p/ mídia) |

Documentação também na tela **API** do painel.

---

## 7. Limitações e pendências

- **Foto de perfil do contato:** ❌ não disponível via iaSolution/WhatsApp Cloud API (limitação da Meta). O `GET /api/v1/profile` do Hub retorna só a foto do **seu** número business. Só Baileys pega foto de contato.
- **Log temporário do iaSolution** (`iaSolution RAW value`, commit `4a61666`) ainda ativo, poluindo os logs do backend — pendente remover.
- **Migração CRA → Vite** (opcional) para deploys de frontend em segundos.

---

## 8. Infra / Deploy (o CLAUDE.md está desatualizado — ver memória)
- VPS: `2.25.169.60` (EasyPanel + Docker Swarm). Chave SSH: `~/.ssh/crm_vps_deploy`.
- Serviços: `crm-destaquese_backend` / `crm-destaquese_frontend` (Swarm **manual**, imagens locais — não pelo EasyPanel).
- Domínios reais: API `apicrm.destaqueseagora.com.br`, front `crm-destaquese.destaqueseagora.com.br`.
- Repo de deploy: remote `crm` (`git push crm main`).
- Processo: `git archive <commit> | ssh ... tar -x -C /root/deploy-crm` → `docker build` → `docker service update --force`. Migrações rodam no start do backend.

---

## 9. Commits de hoje (mais recente primeiro)
```
2a24cf7 fix(kanban): card nao some ao sair de coluna (filtro do "Aberto")
60491a6 fix(kanban): soltar card em qualquer parte da coluna (drop-zone cheio)
ebcb3f0 fix(realtime): tags do ticket refletem na lista/Kanban sem recarregar
ddf2c12 chore(kanban): remove acoes de automacao nao implementadas do builder
cd4180f fix(kanban): atualizacao em tempo real (socket)
9d26d7e feat(tags): API externa para remover tag do atendimento
e175edb fix(kanban): habilitar arraste de coluna (prop draggable no Board)
28885f1 feat(kanban): reordenar colunas do pipeline (arrastar e salvar)
2efd864 feat(kanban): API externa para consultar lead
7a4cb35 perf(docker): cachear yarn install
fcf8180 feat(kanban): API externa para mover card de coluna
a387e45 fix(kanban): campo personalizado no modal exibe texto completo (multiline)
ae13a08 fix(kanban): modal do card busca ticket completo via API + botao Ver detalhes
ea4d649 fix(kanban): clique no card abre modal com o ticket completo
3991bf7 feat(kanban): campos no card limitados a 2 + modal de detalhes
83ccb78 feat(kanban): motor de automacao avancado (fase 3)
a4ae9dd feat(kanban): menu da coluna + Configuracoes da Coluna com abas (fase 2)
fa597b5 feat(kanban): valor do negocio no card + total/contagem por coluna (fase 1)
cdfcf52 feat(kanban): editar/remover campos personalizados pela UI + doc
d1f2704 feat(kanban): campos personalizados no card via API
5a7908c fix(kanban): gatilho de automacao usava params trocados do react-trello
184d914 feat(kanban): automacoes por coluna (fase 2)
0ed92d4 feat(kanban): aparencia configuravel do card (fase 1)
6ad2041 feat(templates): criar template pela plataforma (iaSolution)
f1a772a fix(templates): /official-connections quebrava (coluna number inexistente)
30f4088 feat(templates): botao Sincronizar templates (iaSolution + oficial)
90d8fb0 feat(templates): suporte a message templates no canal iaSolution
bb56932 fix(i18n): locale do calendario tambem inicia em pt-BR
02500fc fix(tags): API de tag nao duplica ticket + painel inicia em pt-BR
```
