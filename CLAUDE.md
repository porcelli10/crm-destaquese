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

> Verificado em 2026-07-15 direto na VPS. Se algo aqui divergir do servidor, o servidor tem razão — atualize este arquivo.

- **IP:** 2.24.81.12 (Hostinger, Ubuntu 22.04, hostname `srv1648875`)
- **SSH:** `ssh root@2.24.81.12`
- **Código na VPS:** `/opt/atendimento_destaque_se`
- **Repositório GitHub:** `git@github.com:porcelli10/atendechat-destaque-se.git` (privado) — é o `origin` de `/opt/atendimento_destaque_se`
- **Deploy key na VPS:** `/root/.ssh/easypanel_atendechat`
- **Frontend:** https://atende.destaqueseagora.com.br
- **Backend/API:** https://api2.destaqueseagora.com.br
- **Banco:** `atendimento_destaque_se` (PostgreSQL 14)

### Nomes dos serviços ≠ nome da pasta

Cuidado: a pasta é `atendimento_destaque_se`, mas os serviços e imagens Docker se chamam **`crm-destaquese`**. Não existe serviço `atendimento_destaque_se_*` — esse nome é histórico.

| Coisa | Nome real |
|---|---|
| Serviços Swarm | `crm-destaquese_backend`, `crm-destaquese_frontend`, `crm-destaquese_postgres`, `crm-destaquese_redis` |
| Imagens | `crm-destaquese-backend:latest`, `crm-destaquese-frontend:latest` |
| Stack file | `/opt/atendimento_destaque_se/stack-crm-destaquese.yml` |
| Traefik | `/etc/easypanel/traefik/config/crm-destaquese.yaml` |

`stack.yml` e `stack.yml.bak` na mesma pasta são de junho/2026 e **não** são os usados.

### ATENÇÃO — Não tocar
A VPS roda outros serviços via EasyPanel (`automacoes-destaquese_*` — n8n + Evolution API — e o próprio `easypanel`/`easypanel-traefik`). **Nunca mexer no que não começa com `crm-destaquese_`.**

### Existe uma segunda VPS (2.25.169.60)

Roda um stack **separado** com o mesmo código, servindo `crm-destaquese.destaqueseagora.com.br` + `apicrm.destaqueseagora.com.br`. Confusamente, os serviços lá **também** se chamam `crm-destaquese_*`. Sempre confira o IP antes de rodar qualquer comando.

---

## Processo de deploy

### 0. Backup antes (as migrations rodam sozinhas no start do backend)

```bash
mkdir -p /root/backups
docker exec $(docker ps -q -f name=crm-destaquese_postgres) \
  pg_dump -U postgres -d atendimento_destaque_se > /root/backups/atende-$(date +%Y%m%d-%H%M%S).sql

# Rollback da imagem: tagueie a atual antes de sobrescrever
docker tag crm-destaquese-backend:latest  crm-destaquese-backend:rollback-$(date +%Y%m%d)
docker tag crm-destaquese-frontend:latest crm-destaquese-frontend:rollback-$(date +%Y%m%d)
```

### 1. Pull do código

```bash
cd /opt/atendimento_destaque_se
GIT_SSH_COMMAND='ssh -i /root/.ssh/easypanel_atendechat -o IdentitiesOnly=yes' \
  git pull --ff-only origin main
```

`frontend/yarn.lock` tem uma modificação local antiga. Ela não conflita (o arquivo não muda upstream) — não tente "limpar" com `git checkout .`.

### 2. Build — Backend

```bash
cd /opt/atendimento_destaque_se     # contexto = RAIZ do repo, não backend/

docker build -t crm-destaquese-backend:latest \
  -f backend/Dockerfile \
  --build-arg STACK_NAME=atendimento_destaque_se \
  .
```

### 3. Build — Frontend

Os `REACT_APP_*` são compilados **dentro** do bundle: errar a URL aqui quebra o painel em runtime, sem erro de build. Nesta VPS é `api2`, **não** `apicrm`.

```bash
docker build -t crm-destaquese-frontend:latest \
  -f frontend/Dockerfile \
  --build-arg REACT_APP_BACKEND_URL=https://api2.destaqueseagora.com.br \
  --build-arg REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24 \
  --build-arg STACK_NAME=atendimento_destaque_se \
  --build-arg REACT_APP_COLOR='#682EE3' \
  --build-arg REACT_APP_TAB_NAME='Destaque-se Atendimento' \
  .
```

Os args de Facebook (`REACT_APP_FACEBOOK_*`) existem no Dockerfile mas estão **vazios** na imagem em produção — não invente valores. Para conferir com que args a imagem no ar foi construída:

```bash
docker image inspect crm-destaquese-frontend:latest \
  --format '{{range .Config.Env}}{{println .}}{{end}}' | grep REACT_APP
```

**Não use `--no-cache`.** Os Dockerfiles foram reordenados (commit `7a4cb35`) para cachear o `yarn install`; `--no-cache` joga isso fora e o build vai de ~2 min para muitos minutos. O cache do Docker invalida por conteúdo — é seguro.

### 4. Subir (`--force` é obrigatório, senão fica a imagem antiga)

```bash
docker service update --force crm-destaquese_backend    # migrations rodam aqui
docker service update --force crm-destaquese_frontend
```

### 5. Verificar

```bash
docker service ls | grep crm-destaquese                       # todos 1/1

# Rotas novas devem dar 401 (existem, pedem token); uma rota falsa dá 404.
curl -s -o /dev/null -w '%{http_code}\n' https://api2.destaqueseagora.com.br/api/kanban/lead
curl -s -o /dev/null -w '%{http_code}\n' https://atende.destaqueseagora.com.br/   # 200

# Migrations aplicadas?
docker exec $(docker ps -q -f name=crm-destaquese_postgres) \
  psql -U postgres -d atendimento_destaque_se -c 'SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 5;'
```

`404` na raiz de `api2` é **normal** — a API não tem rota em `/`. Significa que está viva.

## Comandos úteis na VPS

```bash
docker service ls | grep crm-destaquese              # status (não use `docker stack services`)
docker service logs crm-destaquese_backend --tail 50
docker service logs crm-destaquese_frontend --tail 50
docker ps | grep crm-destaquese
```

### Erro conhecido e inofensivo no boot

No start do backend aparece:

```
== 20200904070005-create-default-company: migrating =======
ERROR: Validation error
```

É o seeder da empresa padrão falhando porque ela já existe. **Não é fatal** — o backend sobe e opera normalmente depois disso.

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

Arquivo em `/opt/atendimento_destaque_se/**stack-crm-destaquese.yml**` (não `stack.yml`, que é antigo). Serviços:

- `crm-destaquese_postgres` — PostgreSQL 14, banco `atendimento_destaque_se`
- `crm-destaquese_redis` — Redis 7
- `crm-destaquese_backend` — API (porta 3000)
- `crm-destaquese_frontend` — React (porta 3001)

Roteamento via Traefik: `/etc/easypanel/traefik/config/crm-destaquese.yaml`
- `atende.destaqueseagora.com.br` → `crm-destaquese_frontend:3001`
- `api2.destaqueseagora.com.br` → `crm-destaquese_backend:3000`

O stack file contém segredos em texto puro (senha do Postgres, `JWT_SECRET`, `FACEBOOK_APP_SECRET`). Ele **não** está no git — vive só na VPS. Mantenha assim.
