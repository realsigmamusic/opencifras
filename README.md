# ChordSheets
Uma aplicação web rápida, leve e direto ao ponto para gerenciamento, visualização e busca de cifras musicais no formato [**ChordPro**](https://github.com/ChordPro/chordpro). Projetado especificamente para músicos e ministérios de louvor que precisam de acesso instantâneo, organizado e 100% confiável ao seu repertório, mesmo em locais sem internet.

## Funcionalidades
* **Suporte 100% Offline (PWA):** Uma vez instalado no celular ou computador, o aplicativo funciona perfeitamente sem internet. O mecanismo baixa o catálogo inteiro silenciosamente em segundo plano.
* **Geração Automática do Catálogo:** Um script de automação em Node.js varre suas pastas, limpa tags estruturais e monta o banco de dados sozinho.
* **Busca Inteligente (Fuzzy Search):** Utiliza o **Fuse.js** para buscas instantâneas e tolerantes a erros de digitação. Pesquise por título, artista ou trechos da letra.
* **Leitura Dinâmica:** As cifras são renderizadas dinamicamente através do `index.html` (aplicativo de página única), que captura os parâmetros (`?file=`) e renderiza o arquivo `.cho` via URL.
* **Ferramentas de Palco:** Transposição de tom em tempo real (+/-) com o valor de transposição clicável para resetar, e ajuste dinâmico do tamanho da fonte com salvamento automático de preferências.
* **Alta Performance:** Construído com JavaScript puro (Vanilla) e folha de estilos enxuta para garantir carregamento em milissegundos e consumo mínimo de bateria.

## Tecnologias Utilizadas
* **HTML5 / CSS3** (Com variáveis dinâmicas e design responsivo focado no mobile)
* **JavaScript (Vanilla / ES6):** Gerencia a lógica de navegação de página única (SPA), busca, transposição e favoritos.
* **Service Workers & Cache Storage API** (Para a mecânica offline do PWA)
* **[ChordSheetJS](https://github.com/martijnversluis/ChordSheetJS)** (Parser e renderizador oficial do ChordPro)
* **[Fuse.js](https://fusejs.io/)** (Motor de busca fuzzy local)

## Como o banco de dados funciona (E Automação)
O repertório é mantido de forma simples através de arquivos `.cho` dentro da pasta `songs/`. Para que o aplicativo não precise de um banco de dados pesado, utilizamos um script automatizado em Node.js (`build.js`) que lê a sua pasta de músicas e gera o arquivo `songs.json` na raiz do projeto.

O script extrai os metadados do ChordPro e faz uma limpeza prévia, removendo tags estruturais (como `{start_of_verse}`, `{end_of_chorus}`) do indexador para manter a busca por texto limpa e precisa.

### Como gerar/atualizar o catálogo:
Sempre que adicionar ou editar uma música na pasta `songs/`, rode o comando abaixo no terminal para atualizar o seu índice:

```bash
node build.js
```

ou:

```bash
npm run build
```

## PWA & Estratégia de Atualização Offline
O projeto utiliza um Service Worker configurado com a estratégia **Stale-while-revalidate** combinado com um instalador individual à prova de falhas.

Ao abrir o aplicativo, ele carrega instantaneamente os dados do cache local (velocidade máxima). Se houver conexão com a internet, o Service Worker verifica o `songs.json` em segundo plano e atualiza as novas cifras arquivo por arquivo.
* **Estratégia de Cache Inteligente:** O Service Worker utiliza a estratégia "Stale-while-revalidate" para garantir que o aplicativo carregue instantaneamente do cache e, em segundo plano, verifique por atualizações.
* **Atualização de Conteúdo:** Ao gerar um novo lote de músicas com `build.js`, o Service Worker detecta automaticamente as mudanças no `songs.json` e baixa as novas cifras individualmente. A atualização da `CACHE_NAME` no `sw.js` só é necessária para forçar a atualização dos arquivos principais do aplicativo (HTML, CSS, JS).

## Como executar localmente
Como o projeto utiliza a `Fetch API` localmente para carregar os arquivos JSON e as cifras, o navegador bloqueará o funcionamento direto se você apenas clicar duas vezes no `index.html` (Erro de CORS). Você precisará de um servidor web local simples.

### Usando Python
Se você tiver o Python instalado, basta rodar dentro da pasta do projeto:

```bash
python -m http.server 8000
```

E acessar `http://localhost:8000` no navegador.

### Usando o Node.js (npx)
Se preferir usar o ecossistema do Node, você pode levantar um servidor rápido com:
```bash
npx http-server .
```

### Usando o VS Code / VSCodium
1. Instale a extensão **Live Server**.
2. Clique com o botão direito no arquivo `index.html` e selecione **"Open with Live Server"**.

## Licença
Distribuído sob a licença **[MIT](https://www.google.com/search?q=LICENSE)**.