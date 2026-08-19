# Super-App Backend — SaaS de Orquestração para Varejo Local

Backend multi-tenant (Node.js + TypeScript + PostgreSQL) para um agregador de
lojas locais (hamburguerias, pet shops, lojas de roupas, minimercados) com
três fluxos de compra: **Delivery**, **Pickup (Take-away)** e **In-Store**
(escanear código de barras na prateleira).

## Decisões arquiteturais chave

- **Sem pagamento próprio.** O SaaS só orquestra pedidos; `payment_status`
  nunca vira "pago pela plataforma" — é sempre `PENDING_EXTERNAL` ou
  `PAID_AT_STORE`. Isso blinda o produto de riscos financeiros/regulatórios
  (não somos instituição de pagamento).
- **Estoque pragmático.** Sem integração com PDV no MVP. Cada produto tem
  `current_stock` e `safety_stock` (margem de segurança); o pedido só é aceito
  se `current_stock - safety_stock >= quantidade`. A baixa de estoque é feita
  dentro da mesma transação do pedido, com `SELECT ... FOR UPDATE` para evitar
  overselling em concorrência.
- **Offline-friendly.** `GET /stores/:slug/catalog` suporta `?since=<ISO>`
  para sync incremental e devolve `ETag`/`Cache-Control` para o app mobile
  cachear o catálogo e continuar funcionando com 4G instável dentro da loja.
- **Multi-tenant.** Toda tabela de domínio tem `tenant_id` indexado. O
  middleware `resolveTenant` resolve a loja pelo `:slug` da URL e é aplicado
  antes de qualquer query — evita vazamento de dados entre lojas.
- **LGPD.** `users.lgpd_accepted` + `terms_accepted_at` + `terms_version`
  registram o aceite. `DELETE /users/:id` implementa o direito ao
  esquecimento anonimizando dados pessoais (sem apagar o histórico de
  pedidos, que pertence ao lojista para fins fiscais/contratuais).

## Estrutura de pastas

```
src/
├── server.ts                  # entrypoint (HTTP + Socket.io)
├── app.ts                     # configuração do Express
├── config/
│   └── database.ts            # pool pg + helper de transação
├── middlewares/
│   ├── tenant.middleware.ts   # resolve loja pelo slug
│   └── error.middleware.ts
├── modules/
│   ├── products/               # catálogo (cache/offline) + busca por barcode
│   ├── orders/                 # orquestração de pedidos (schema/service/repo)
│   ├── chat/                   # Socket.io — chat por order_id
│   └── lgpd/                   # aceite de termos + exclusão de dados
├── database/migrations/
│   └── 001_init.sql
└── types/
```

## Rodando localmente

```bash
cp .env.example .env   # ajuste DATABASE_URL
npm install
npm run migrate        # aplica o schema
npm run dev
```

## Deploy no Railway

1. Crie um serviço Postgres no Railway e linke ao serviço Node — `DATABASE_URL`
   é injetada automaticamente.
2. Configure `JWT_SECRET` e `CORS_ORIGIN` nas variáveis do serviço.
3. Build command: `npm run build` · Start command: `npm start`.
4. Rode `npm run migrate` uma vez (via Railway CLI ou job) para criar o schema.

## Autenticação

Dois tipos de token JWT, diferenciados pelo campo `type` no payload:

- **CUSTOMER** — cliente final do app. Obtido em `POST /auth/register` ou `POST /auth/login`.
- **STORE_STAFF** — funcionário/dono da loja, escopado a um `tenant_id`. Obtido em
  `POST /auth/store-login` (exige `tenant_slug` porque o e-mail só é único dentro da loja).

Envie `Authorization: Bearer <token>` nas rotas protegidas. `requireStoreStaffAuth`
também confere que o `tenant_id` do token bate com a loja da URL — um funcionário
da Loja A nunca consegue mexer no catálogo da Loja B, mesmo com token válido.

## Endpoints de exemplo entregues

**Públicos (app do cliente):**
- `POST /auth/register` / `POST /auth/login` — cadastro e login de cliente (LGPD já no cadastro).
- `GET /stores/:slug/catalog` — catálogo com suporte a cache/sync incremental.
- `GET /stores/:slug/products/barcode/:code` — lookup por código de barras (fluxo IN_STORE).
- `POST /orders` *(auth CUSTOMER)* — criação de pedido orquestrado (valida estoque, trava linhas, nunca cobra).
- `DELETE /users/:id` — direito ao esquecimento (LGPD), anonimiza dados pessoais.
- Socket.io: `join_order`, `send_message`, `new_message` — chat isolado por `order_id`.

**Lojista (painel de gestão):**
- `POST /auth/store-login` — login da equipe da loja.
- `POST /stores/:slug/products` *(auth STORE_STAFF)* — cadastra produto.
- `PATCH /stores/:slug/products/:id/stock` *(auth STORE_STAFF, role OWNER/MANAGER)* — ajuste absoluto de estoque (ex: contagem física).
- `PATCH /stores/:slug/products/:id/active` *(auth STORE_STAFF, role OWNER/MANAGER)* — ativa/desativa produto.
