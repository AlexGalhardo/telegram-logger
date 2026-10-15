# Como publicar e atualizar este pacote (npm + JSR)

> 🇺🇸 [Read in English](../en/how-to-deploy-and-update-this-package.md)

O pacote é publicado em dois registries a partir do mesmo código:

| Registry | O que é publicado                                    | Como autentica                            |
| -------- | ---------------------------------------------------- | ----------------------------------------- |
| **npm**  | `dist/` (ESM + CJS + `.d.ts`), gerado por `bun run build` | Trusted Publishing (OIDC), sem token      |
| **JSR**  | Os fontes `.ts` de `src/` direto, definidos em `jsr.json` | Repositório GitHub vinculado (OIDC), sem token |

O processo de release é automatizado com o [release-please](https://github.com/googleapis/release-please). Nenhum segredo fica salvo no GitHub.

---

## Como funciona, no dia a dia

```
você faz commits (feat:, fix:...) → push na main
        │
        ▼
GitHub Action "Release" abre/atualiza um PR "chore(main): release 0.2.0"
(bump de versão no package.json + jsr.json e CHANGELOG.md gerado)
        │
        ▼  você revisa e faz merge desse PR
        │
        ▼
release-please cria a tag v0.2.0 + GitHub Release
        │
        ▼
jobs "publish-npm" e "publish-jsr" (em paralelo): testam, buildam e publicam
```

Você **não** altera a versão manualmente. Ela é calculada a partir das mensagens de commit.

### 1. Escreva commits no padrão Conventional Commits

| Commit                                    | Exemplo                                  | Antes da 1.0      | Depois da 1.0     |
| ----------------------------------------- | ---------------------------------------- | ----------------- | ----------------- |
| `fix: ...`                                | `fix: escape & inside meta keys`         | patch `0.1.0 → 0.1.1` | patch `1.2.0 → 1.2.1` |
| `feat: ...`                               | `feat: add sendPhoto method`             | minor `0.1.0 → 0.2.0` | minor `1.2.0 → 1.3.0` |
| `feat!: ...` ou rodapé `BREAKING CHANGE:` | `feat!: rename chatIds to routes`        | minor `0.1.0 → 0.2.0` | **major** `1.2.0 → 2.0.0` |
| `docs:`, `chore:`, `test:`, `refactor:`, `ci:` | `docs: improve Next.js example`      | não gera release  | não gera release  |

Os commits que geram release aparecem no CHANGELOG. Se um commit ficar fora do padrão, ele é ignorado. Nada quebra.

### 2. Faça push na `main`

Você pode commitar direto na main ou abrir um PR (de preferência com "Squash and merge", usando um título no padrão Conventional Commits).

```bash
git add .
git commit -m "feat: add photo support"
git push
```

### 3. Faça merge do PR de release

Em **Pull requests** vai aparecer `chore(main): release X.Y.Z`. Ele é atualizado sozinho a cada novo push na main, então você pode acumular várias mudanças antes de lançar.

Quando quiser lançar, clique em **Merge**. Em 1 a 2 minutos a nova versão está nos dois sites. Para acompanhar, vá em **Actions → Release**.

> O PR de release é criado pelo `GITHUB_TOKEN`. Por uma limitação do GitHub, isso **não** dispara o workflow de CI nele. Isso não é um problema: o job de publish roda os testes e o build antes de publicar.

### 4. Confira

```bash
npm view @galhardoalex/telegram-logger version
```

- npm: https://www.npmjs.com/package/@galhardoalex/telegram-logger (deve mostrar o selo "Provenance")
- JSR: https://jsr.io/@galhardoalex/telegram-logger (confira também a aba **Score**)

---

## Casos especiais

### Lançar a 1.0.0, ou forçar uma versão específica

Adicione o rodapé `Release-As` a um commit:

```bash
git commit --allow-empty -m "chore: release 1.0.0" -m "Release-As: 1.0.0"
git push
```

O próximo PR de release vai usar exatamente essa versão.

### A publicação falhou (rede, registry fora do ar, configuração)

1. Corrija a causa.
2. Vá em **Actions → Release → Run workflow** (branch `main`).

O job publica a versão que está no `package.json`. Se essa versão já existir em algum dos registries, ele pula aquele registry. Por isso, pode rodar quantas vezes precisar.

### Validar tudo localmente antes do push

```bash
bun install
bun run check       # lint + typecheck + testes + build + publint + are-the-types-wrong
bun run check:jsr   # simula a publicação no JSR (slow types, arquivos incluídos)
npm pack --dry-run  # lista exatamente os arquivos que vão para o npm
```

### Descontinuar uma versão com bug

- **npm:** `npm deprecate @galhardoalex/telegram-logger@0.3.0 "Bug X, use 0.3.1"`.
  O `npm unpublish` só é permitido nas primeiras 72h e deve ser evitado.
- **JSR:** acesse jsr.io → pacote → **Versions** → **Yank** na versão.

Depois, publique a correção normalmente, com um commit `fix:`.

---

## Setup inicial (feito uma única vez)

Já foi feito na criação do projeto. Fica registrado aqui caso você precise refazer, por exemplo ao transferir o repo ou recriar o pacote.

### A. GitHub

1. Repositório: https://github.com/AlexGalhardo/telegram-logger
2. **Settings → Actions → General → Workflow permissions:**
   - marque **Read and write permissions**
   - marque **Allow GitHub Actions to create and approve pull requests** (o release-please precisa disso)

   Pelo terminal:

   ```bash
   gh api -X PUT repos/AlexGalhardo/telegram-logger/actions/permissions/workflow \
     -f default_workflow_permissions=write -F can_approve_pull_request_reviews=true
   ```

### B. JSR

1. Acesse https://jsr.io e faça login com o GitHub.
2. Em https://jsr.io/new, crie o escopo `@galhardoalex` e o pacote `telegram-logger`.
3. No pacote, vá em **Settings → GitHub Repository** e vincule `AlexGalhardo/telegram-logger`. É isso que autoriza o GitHub Actions a publicar via OIDC, sem token.
4. Ainda em **Settings**, preencha a descrição e marque os runtimes compatíveis: Node.js, Deno, Bun, Cloudflare Workers e Browsers. Isso conta pontos no JSR Score.
5. **Se o pacote já existia e está arquivado**, desarquive em **Settings → Archive → Unarchive package**. O JSR recusa publicação em pacote arquivado.
   - Versões *yanked* continuam reservadas: um número de versão já usado nunca pode ser publicado de novo.
6. A página do pacote mostra duas formas de publicar:
   - **Pelo CI (usada aqui):** o `release.yml` já tem `permissions: id-token: write` e roda `npx jsr publish`. Não precisa de nenhum segredo, porque o repo está vinculado.
   - **Pela CLI, da sua máquina:** rode `npx jsr publish` (ou `deno publish`) na raiz do projeto. O navegador abre para você autorizar. É útil para emergências.
7. Para a **primeira** publicação, vá em **Actions → Release → Run workflow**. O job `publish-jsr` publica a versão que está no `jsr.json`.

> Os jobs `publish-npm` e `publish-jsr` são independentes: se um registry falhar, o outro publica mesmo assim. Corrija o problema e rode **Run workflow** de novo. A versão que já foi publicada é pulada.

### C. npm

O escopo `@galhardoalex` precisa ser o seu username (ou uma org) no npmjs.com: confira com `npm whoami`.

O Trusted Publishing só pode ser configurado em um pacote que já existe. Por isso, a **primeira** versão foi publicada manualmente:

```bash
npm login
bun install && bun test && bun run build
npm publish --access public --provenance=false   # provenance só funciona dentro do CI
```

Depois disso:

1. Acesse https://www.npmjs.com/package/@galhardoalex/telegram-logger/access, ou **Settings** do pacote.
2. Em **Trusted Publisher**, escolha **GitHub Actions** e preencha:
   - Organization or user: `AlexGalhardo`
   - Repository: `telegram-logger`
   - Workflow filename: `release.yml`
   - Environment: deixe vazio
3. Recomendado: em **Publishing access**, marque *"Require two-factor authentication and disallow tokens"*. A partir daí, só o CI consegue publicar.

### D. Marcar a versão inicial para o release-please

O release-please precisa saber de onde partir. Para isso, foi criada a release `v0.1.0` apontando para o commit inicial:

```bash
gh release create v0.1.0 --title "v0.1.0" --notes "Initial release"
```

---

## Arquivos envolvidos

| Arquivo                                 | Função                                                              |
| --------------------------------------- | ------------------------------------------------------------------- |
| `.github/workflows/ci.yml`              | Lint, typecheck, testes, build, validação npm/JSR, smoke tests em Node 18–24 e Deno |
| `.github/workflows/release.yml`         | release-please + jobs independentes `publish-npm` e `publish-jsr`   |
| `release-please-config.json`            | Tipo de release (node), bump de `jsr.json`, regras pré-1.0          |
| `.release-please-manifest.json`         | Última versão lançada. É atualizado pelo release-please; não edite. |
| `package.json` / `jsr.json`             | Versão (sempre iguais; o release-please atualiza os dois)           |
| `CHANGELOG.md`                          | Gerado automaticamente                                              |
| `scripts/build.ts`                      | Build do npm: ESM, CJS, `.d.ts` e `.d.cts`                          |
