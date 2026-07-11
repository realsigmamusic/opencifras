# OpenCifras

O **opencifras** é uma aplicação web (PWA) minimalista, de alta performance e direto ao ponto para gerenciamento, busca e visualização de cifras musicais no formato [**ChordPro**](https://github.com/ChordPro/chordpro). 

Projetado especificamente para músicos de palco e ministérios de louvor, o aplicativo elimina a necessidade de PDFs estáticos ou softwares pesados. Ele combina o poder do formato de colchetes com um ecossistema inteligente de armazenamento local, garantindo cifras dinâmicas, responsivas e que nunca deixam o músico na mão no meio do show.

**Acesse a aplicação rodando no GitHub Pages:** [realsigmamusic.github.io/opencifras](https://realsigmamusic.github.io/opencifras)

---

## Diferenciais

* **Alinhamento Perfeito de Fonte (Sem Quebras):** Ao contrário dos grandes portais de cifras que renderizam o texto de forma rígida em tags `<pre>`, o opencifras processa a cifra estruturalmente em blocos HTML fluidos (`.row`, `.chord`, `.lyrics`) via `ChordSheetJS`. Você pode aumentar ou diminuir a escala da fonte e os acordes permanecem milimetricamente fixados sobre a sílaba correta.
* **Transposer Resiliente com URL Viva:** Mude o tom da música instantaneamente pelos botões de transposição. O tom selecionado é memorizado no dispositivo (por música) e anexado via parâmetro na URL (`?file=...&transpose=...`), facilitando o compartilhamento da cifra no tom exato com os outros integrantes da banda.
* **Busca Avançada com Algoritmo Fuzzy:** Impulsionado pelo `Fuse.js`, a barra de pesquisa executa uma varredura instantânea e profunda cruzando dados de **Título**, **Artista** e trechos da **Letra da música** simultaneamente, ignorando acentos ou erros pequenos de digitação.
* **Filtro por Quantidade de Acordes:** Um menu de filtro (ícone de funil) exibe apenas os níveis de dificuldade que realmente existem no seu acervo, tanto na Home quanto na aba Favoritos, permitindo separar rapidamente repertório mais simples de mais avançado.
* **Rolagem Automática:** Botão dedicado na tela da cifra ativa uma rolagem automática de velocidade fixa, útil para tocar ao vivo sem precisar tocar na tela — ela se interrompe sozinha ao chegar no fim da cifra.
* **PWA com Cache Resiliente:** O Service Worker pré-cacheia cada arquivo `.cho` individualmente (não tudo-ou-nada), então uma música com erro de rede não impede as demais de ficarem disponíveis offline.
* **UI Dinâmica:** Interface limpa construída com variáveis CSS nativas (`:root`). Conta com suporte automático a **Modo Claro e Modo Escuro** via sistema (`prefers-color-scheme`), sincronizando inclusive a barra de status do sistema operacional do celular (`theme-color`).
* **Cifras Próprias (Importar/Criar/Editar):** O botão **+** no menu inferior abre um editor para colar, digitar ou importar um arquivo `.cho` do aparelho. Essas cifras ficam salvas só no `localStorage` do dispositivo e aparecem misturadas ao restante do acervo (busca, Home, artistas, favoritos), com um selo **Local** discreto no card. Também é possível clicar em **Editar cifra** em qualquer música do acervo oficial: o app cria automaticamente uma cópia local editável (sem alterar o arquivo original do repositório) e já abre o editor nela.

---

## Tecnologias e Arquitetura

Focado em simplicidade de deploy, velocidade máxima de carregamento e zero dependência de servidores ativos (Serverless):

* **Vanilla JavaScript (ES6+)** - Sem frameworks complexos (React/Vue), garantindo que o app rode em celulares antigos sem travar.
* **HTML5 & CSS3 Custom Properties** - Layout responsivo, focado em legibilidade de alto contraste sob iluminação de palco.
* **ChordSheetJS** - Motor robusto encarregado de parsear e converter os arquivos `.cho` em HTML responsivo.
* **Fuse.js** - Mecanismo leve de busca fuzzy local.
* **Service Worker (Cache-First)** - Configurado para cachear instantaneamente a casca estrutural do app (HTML, CSS, JS e Vendors), permitindo inicialização offline imediata.

---

## Como o Catálogo é Alimentado

O acervo de músicas é armazenado em formato de texto puro `.cho` dentro da estrutura do projeto. Para manter a aplicação leve e estática, o índice de busca é centralizado em um arquivo único `songs.json` gerado via automação.

### O Fluxo de Trabalho:
**Build do Catálogo:** Execução do script gerador (`build.js`, Node.js) que varre recursivamente a pasta `songs/`, e para cada `.cho`:
* Extrai os metadados ChordPro (`{title:}`, `{artist:}` etc.);
* Extrai a letra limpa (sem acordes) para indexação pelo `Fuse.js`;
* Conta os **acordes únicos/distintos** da música (`chordCount`), usado no filtro por dificuldade;
* Carimba o timestamp de modificação (`mtime`, usado na seção de Recentes).

O resultado é escrito em `songs.json`, consumido pelo app no navegador.

Sempre que o catálogo for atualizado, basta rodar `node build.js` e fazer o `git push` para atualizar o GitHub Pages automaticamente.

### Cifras Locais (do usuário)

Além do acervo oficial em `songs.json`, o app mantém no navegador um segundo catálogo, **por aparelho**, com as cifras que o próprio usuário importou ou criou (`assets/js/local-songs.js`, salvo em `localStorage`). Em tempo de execução os dois catálogos são unidos numa única lista (busca, Home, artistas e favoritos enxergam tudo junto), e cada cifra local ganha um "arquivo" sintético no formato `local:<id>` para se comportar como qualquer outra música do acervo. Nada disso passa pelo `build.js` nem é publicado no GitHub Pages — é conteúdo que existe só localmente, no aparelho de quem o criou.

---

## Organização do Projeto

* `index.html`: Ponto de entrada único do aplicativo (SPA). Alterna entre a Home (busca, artistas, favoritos, configurações) e a tela da cifra via parâmetro `?file=` na URL, sem recarregar a página. Também contém o editor de cifras (`#cho-editor-overlay`), usado para importar, criar e editar cifras locais.
* `build.js`: Script Node.js que varre `songs/`, faz o parse dos arquivos `.cho` e gera o `songs.json`.
* `sw.js`: Service worker focado no isolamento e persistência offline dos assets e das cifras.
* `songs.json`: Índice estruturado de metadados de todo o acervo oficial (título, artista, letra, `chordCount`, `mtime`), gerado pelo `build.js`.
* `assets/js/local-songs.js`: Camada de armazenamento das cifras locais (`localStorage`) — ler, salvar, excluir e converter uma cifra local no mesmo formato de catálogo usado pelas músicas do `songs.json`. Compartilhada entre `app.js` e `song.js`.
* `assets/js/app.js`: Inteligência da tela inicial — busca fuzzy, filtro por acordes, favoritos, listagem de artistas, e o editor de cifras acessado pelo botão **+** do menu inferior.
* `assets/js/song.js`: Motor de renderização da cifra — transposição, escala de fontes, favoritar, compartilhar, baixar, rolagem automática e o botão **Editar cifra** (que cria uma cópia local ao editar uma música oficial).
* `assets/css/`: Folhas de estilo divididas (`style.css` para a estrutura global, componentes de UI e o editor de cifras; `song.css` para o comportamento e design visual dos acordes).
* `songs/`: Acervo de cifras em texto puro, no formato `.cho` (ChordPro).

---

## Execução Local

Como o projeto faz requisições locais (`Fetch API`) para carregar o `songs.json` e os arquivos `.cho`, o navegador bloqueará o funcionamento se você abrir o `index.html` clicando duas vezes (Erro de CORS). É necessário rodar um servidor local simples:

### Usando Python
```bash
python -m http.server 8000

```

Acesse `http://localhost:8000`

### Usando o Node.js

```bash
npx http-server .

```

### Usando o VS Code / Code OSS

Instale a extensão **Live Server**, clique com o botão direito no `index.html` e selecione **"Open with Live Server"**.

---

## Licença

Este projeto está sob a licença **MIT**. Sinta-se livre para usar, clonar e adaptar para a sua banda ou igreja.