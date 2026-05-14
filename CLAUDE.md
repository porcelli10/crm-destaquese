# CLAUDE.md — Atende Chat · Destaque-se

Instruções permanentes para o Claude Code neste projeto. Leia antes de qualquer ação.

---

## O que é este projeto

CRM de atendimento via WhatsApp (multi-tenant SaaS), white-label com marca **Destaque-se**.
- Frontend: React.js + Material-UI v4
- Backend: Express.js + TypeScript + Sequelize
- Banco: PostgreSQL + Redis
- Infra: Docker Swarm na VPS Hostinger

---

## Estrutura de pastas

```
/
├── frontend/          # React app (porta 3001)
│   ├── src/
│   │   ├── App.js           ← tema MUI (cores, palette)
│   │   ├── layout/
│   │   │   ├── index.js     ← AppBar + Sidebar (Drawer)
│   │   │   └── MainListItems.js  ← itens do menu (emojis como ícones)
│   │   └── pages/Login/index.js  ← página de login
│   └── Dockerfile
├── backend/           # Express + TypeScript (porta 3000)
│   ├── src/
│   ├── Dockerfile
│   └── docker-entrypoint.sh
└── brands/            # Logos white-label (incluído no git)
    └── atendimento_destaque_se-logo.png
```

---

## VPS e Deploy

- **IP:** 2.24.81.12 (Hostinger KVM 8, Ubuntu 22.04)
- **SSH:** `ssh root@2.24.81.12`
- **Código na VPS:** `/opt/atendimento_destaque_se`
- **Deploy key GitHub:** `/root/.ssh/easypanel_atendechat`
- **Frontend:** https://atende.destaqueseagora.com.br
- **Backend/API:** https://api2.destaqueseagora.com.br

### ATENÇÃO — Não tocar
A VPS roda outros clientes via EasyPanel (n8n + Evolution API). **Nunca mexer nos serviços que não são `atendimento_destaque_se_*`**.

---

## Processo de deploy — Frontend

```bash
cd /opt/atendimento_destaque_se

# 1. Pull do código
GIT_SSH_COMMAND='ssh -i /root/.ssh/easypanel_atendechat' git pull origin main

# 2. Build (contexto = RAIZ do repo, não frontend/)
docker build --no-cache -t atendimento_destaque_se_frontend:latest \
  -f frontend/Dockerfile \
  --build-arg REACT_APP_BACKEND_URL=https://api2.destaqueseagora.com.br \
  --build-arg REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24 \
  --build-arg STACK_NAME=atendimento_destaque_se \
  --build-arg REACT_APP_COLOR=#682EE3 \
  --build-arg "REACT_APP_TAB_NAME=Destaque-se Atendimento" \
  .

# 3. SEMPRE usar --force (sem isso o container fica com imagem antiga)
docker service update --force atendimento_destaque_se_frontend
```

## Processo de deploy — Backend

```bash
cd /opt/atendimento_destaque_se

GIT_SSH_COMMAND='ssh -i /root/.ssh/easypanel_atendechat' git pull origin main

docker build --no-cache -t atendimento_destaque_se_backend:latest \
  -f backend/Dockerfile \
  --build-arg STACK_NAME=atendimento_destaque_se \
  .

docker service update --force atendimento_destaque_se_backend
```

## Comandos úteis na VPS

```bash
# Status dos serviços
docker stack services atendimento_destaque_se

# Logs do backend (últimas 50 linhas)
docker service logs atendimento_destaque_se_backend --tail 50

# Logs do frontend
docker service logs atendimento_destaque_se_frontend --tail 50

# Ver containers rodando
docker ps | grep atendimento_destaque_se
```

---

## Design — Editorial Bold

O sistema usa o estilo visual **Editorial Bold**. Decisões já tomadas — não reverter:

- **Fundo geral:** `#F5F3EF` (creme quente)
- **Cor primária:** `#682EE3` (roxo Destaque-se)
- **Login:** fundo creme, card branco com borda superior roxa de 4px
- **Sidebar:** fundo branco, borda direita `1px solid #E5E2DA`, sem sombra
- **Item ativo no menu:** marcador esquerdo `3px solid #682EE3` + fundo `rgba(104,46,227,0.07)`
- **Ícones do menu:** emoji (componente `<Ei>`) — não MUI icons
- **Subheader "Administração":** uppercase 10px, letter-spacing 1.2px
- **Scrollbars:** 6px, tom creme, sem inset shadow

### Onde estão os estilos
| O que | Arquivo |
|---|---|
| Paleta de cores / tema | `frontend/src/App.js` |
| AppBar + Drawer | `frontend/src/layout/index.js` |
| Itens do menu + emojis | `frontend/src/layout/MainListItems.js` |
| Página de login | `frontend/src/pages/Login/index.js` |

---

## Correções já aplicadas no código (não reverter)

| Problema | Solução |
|---|---|
| TypeScript TS2769 errors | `"noEmitOnError": false` em `backend/tsconfig.json` |
| `yarn build` falha com erros TS | `RUN yarn build \|\| true` no `backend/Dockerfile` |
| Alpine não tem bash | `RUN apk add --no-cache bash` no `frontend/Dockerfile` |
| nodemon causa EMFILE em produção | `docker-entrypoint.sh` usa `node dist/server.js` diretamente |
| Traefik não carrega config JSON | Config em `.yaml` em `/etc/easypanel/traefik/config/` |
| brands/ estava no .gitignore | Removido — pasta `brands/` agora versionada no git |

---

## Credenciais de acesso (admin padrão)

- Email: `admin@admin.com`
- Senha: `123456`

---

## Stack Docker (referência)

Arquivo em `/opt/atendimento_destaque_se/stack.yml`. Serviços:
- `atendimento_destaque_se_postgres` — PostgreSQL 14
- `atendimento_destaque_se_redis` — Redis
- `atendimento_destaque_se_backend` — API (porta 3000)
- `atendimento_destaque_se_frontend` — React (porta 3001)

Roteamento via Traefik: `/etc/easypanel/traefik/config/atendimento_destaque_se.yaml`
