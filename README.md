# Fábrica de Sites — versão independente

Este projeto separa a interface exportada do Claude de uma API própria de IA.

## Arquivos
- `index.html`: interface completa da Fábrica de Sites, adaptada para funcionar fora do Claude.
- `worker.js`: API intermediária para Gemini. A chave fica no Cloudflare Worker, nunca no HTML.

## Configuração obrigatória
1. Publique `worker.js` como um Worker separado no Cloudflare.
2. Em Settings → Variables and Secrets, adicione `GEMINI_API_KEY` como Secret.
3. Use a mesma chave Gemini que você já possui, se desejar; não coloque a chave no GitHub nem no `index.html`.
4. Publique o Worker e copie sua URL.
5. Abra `index.html` e substitua `COLE_A_URL_DO_WORKER_AQUI` pela URL HTTPS do Worker.
6. Faça commit do `index.html` atualizado no GitHub Pages.

O Worker permite chamadas apenas com origem `https://angelalves-dev.github.io`, que é a origem do GitHub Pages da conta. Se publicar em outro domínio, ajuste `ALLOWED_ORIGINS` no Worker para a origem exata.

## Publicação no GitHub Pages
Crie um repositório público separado chamado `fabrica-de-sites`, envie `index.html` para a raiz e ative Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

Endereço esperado: `https://angelalves-dev.github.io/fabrica-de-sites/`.

## Limitações conhecidas desta primeira migração
- As respostas aparecem completas após a API responder; o streaming gradual do Claude foi substituído por resposta em uma etapa.
- Os projetos e conversas continuam salvos no armazenamento local do navegador, não em uma conta/sincronização em nuvem.
- O Worker é um proxy simples; antes de abrir publicamente para muitos usuários, adicione autenticação, limitação de uso e proteção contra abuso.
- A chave Gemini deve existir somente como Secret no Cloudflare Worker.
