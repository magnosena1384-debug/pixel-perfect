# Postos Lemon — Plataforma de treinamento e gestão

Sistema da rede Postos Lemon com:

- **Cursos em vídeo** para as equipes (catálogo, aulas, progresso, materiais e dúvidas respondidas por IA).
- **Gestão do posto** por unidade (vendas, rotinas, pedidos, regulação, manutenção), com acesso
  configurado por usuário.
- **Integração com o webPosto** para importar vendas, operação e financeiro.

Tecnologia: TanStack Start (React) + Supabase (banco, login e arquivos) + Claude (IA), hospedado na Vercel.

## Colocar no ar pela primeira vez

### 1. Banco de dados (Supabase)

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (região São Paulo).
2. No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de
   [`supabase/instalar-banco.sql`](supabase/instalar-banco.sql) e clique em **Run**. Rode uma vez só.
   Isso cria as tabelas, as regras de acesso, as 10 unidades e as pastas de arquivos.
3. Em **Authentication → URL Configuration**, coloque o endereço do site (da Vercel, passo 2) em
   **Site URL** e adicione `https://SEU-SITE/**` em **Redirect URLs**.
4. (Opcional) Login com Google: **Authentication → Sign In / Providers → Google**.
5. Anote em **Project Settings → API** (ou no botão **Connect**) a *Project URL* e a *Publishable key*.

### 2. Site (Vercel)

1. Crie uma conta em [vercel.com](https://vercel.com) entrando com o GitHub.
2. **Add New → Project** e importe o repositório `pixel-perfect`.
3. Em **Environment Variables**, cadastre (veja [`.env.example`](.env.example)):

   | Variável | Valor |
   | --- | --- |
   | `VITE_SUPABASE_URL` e `SUPABASE_URL` | Project URL do Supabase |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_PUBLISHABLE_KEY` | Publishable key do Supabase |
   | `ANTHROPIC_API_KEY` | chave da API do Claude ([console.anthropic.com](https://console.anthropic.com)) |
   | `WEBPOSTO_CHAVE` | chave de integração do webPosto (quando tiver) |

4. Clique em **Deploy**. A cada novo commit na `main`, a Vercel publica sozinha.

### 3. Primeiro acesso

1. Abra o site e **crie sua conta primeiro**: a primeira conta cadastrada vira administradora.
2. Em **Admin → Acessos**, libere a gestão para cada pessoa, por unidade.
3. Em **Admin → Alunos**, libere os cursos.
4. Em **Admin → webPosto**, informe o código de cada unidade no webPosto.

## Desenvolvimento

```sh
bun install
cp .env.example .env   # preencha com os dados do Supabase
bun run dev
```

- Testes: `bun run test` · Lint: `bun run lint` · Tipos: `bunx tsc --noEmit`
- Mudança no banco: nova migração em `drizzle/migrations/` + `bun run db:gerar-instalacao`.
  Num banco já instalado, rode só o SQL da migração nova no SQL Editor.
