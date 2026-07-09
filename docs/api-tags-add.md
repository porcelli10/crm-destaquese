# API — Adicionar Tag a um Atendimento

Atribui uma tag ao atendimento (ticket) existente de um contato, identificado
pelo número. Se a tag ainda não existir na empresa, ela é criada
automaticamente.

> A tag é apenas metadado: esta chamada **não cria** um novo atendimento nem
> altera o status/fila do ticket. Ela localiza o atendimento existente do
> contato e apenas anexa a tag.

## Endpoint

```
POST https://api2.destaqueseagora.com.br/api/tags/add
```

## Autenticação

Header **obrigatório**:

```
Authorization: Bearer <TOKEN>
```

**`<TOKEN>` é o TOKEN DA CONEXÃO do WhatsApp** — aquele que aparece na tela de
**Conexões** do painel, em cada conexão. **Não** é o token de login do usuário
nem a senha de API.

O sistema usa esse token para descobrir automaticamente de qual conexão (e de
qual empresa) parte a requisição. Por isso o `whatsappId` **não** vai na URL
nem no corpo — ele é resolvido a partir do token.

## Corpo (JSON)

```json
{
  "number": "5511999998888",
  "tag": "Nome da Tag",
  "color": "#682EE3"
}
```

| Campo    | Obrigatório | Descrição                                              |
|----------|-------------|--------------------------------------------------------|
| `number` | sim         | Número do contato com DDI + DDD (só dígitos).          |
| `tag`    | sim         | Nome da tag. Se não existir, é criada automaticamente. |
| `color`  | não         | Cor da tag (hex). Padrão: `#5C59A0`.                    |

## Resposta de sucesso (`200`)

```json
{
  "message": "Tag adicionada com sucesso",
  "ticketId": 123,
  "contact": { "id": 45, "number": "5511999998888", "name": "5511999998888" },
  "tag": { "id": 7, "name": "Nome da Tag", "color": "#682EE3" }
}
```

Se a tag já estava aplicada, `message` retorna
`"A tag já estava aplicada a este atendimento"`.

## Erros comuns

| Status | Significado                                                            |
|--------|-----------------------------------------------------------------------|
| `401`  | `Acesso não permitido` — token da conexão ausente ou inválido.        |
| `400`  | `O número é obrigatório` / `A tag é obrigatória`.                     |
| `404`  | `Nenhum atendimento encontrado para este contato`.                    |

## Exemplo (cURL)

```bash
curl -X POST https://api2.destaqueseagora.com.br/api/tags/add \
  -H "Authorization: Bearer SEU_TOKEN_DA_CONEXAO" \
  -H "Content-Type: application/json" \
  -d '{ "number": "5511999998888", "tag": "Lead Quente", "color": "#682EE3" }'
```

## Dica para o n8n (nó HTTP Request)

- **Method:** `POST`
- **URL:** cole sem espaço/quebra de linha antes do `https` (um espaço inicial
  gera o erro `Invalid URL: ...`).
- **Authentication:** *Generic → Header Auth* (ou adicione o header manualmente):
  - Name: `Authorization`
  - Value: `Bearer SEU_TOKEN_DA_CONEXAO`
- **Body Content Type:** `JSON`, com os campos `number`, `tag` e `color`.
