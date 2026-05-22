# ChordSheets
Um aplicação web rápida, leve e direto ao ponto para gerenciamento, visualização e busca de cifras musicais no formato [**chordpro**](https://github.com/ChordPro/chordpro). Projetado para músicos e professores que precisam de acesso instantâneo e organizado ao seu repertório.

## Funcionalidades
* **Listagem Automática:** O repertório é carregado e ordenado alfabeticamente de forma automática.
* **Busca Inteligente (Fuzzy Search):** Utiliza o **Fuse.js** para buscas rápidas e tolerantes a erros de digitação. Pesquise facilmente por título ou artista.
* **Leitura Dinâmica:** As cifras são abertas dinamicamente através da página `song.html`, que captura os parâmetros da música via URL.
* **Alta Performance:** Construído com JavaScript puro (Vanilla) para garantir que a aplicação carregue rapidamente, sem depender de frameworks pesados.

## Tecnologias Utilizadas
* **HTML5 / CSS3**
* **JavaScript (Vanilla / ES6)**
* **[ChordSheetJS](https://github.com/martijnversluis/ChordSheetJS)**
* **[Fuse.js](https://fusejs.io/)**
* **Fetch API**

## Como o banco de dados funciona
O repertório é mantido de forma simples através de um arquivo `songs.json` na raiz do projeto. O aplicativo faz um fetch desse arquivo para montar a lista. 

O formato esperado do arquivo `songs.json` é:

```json
[
  {
    "title": "Nome da Música",
    "artist": "Nome do Artista",
    "key": "G",
    "file": "nome-da-musica.cho"
  },
  {
    "title": "Outra Música",
    "artist": "Outro Artista",
    "key": "Am",
    "file": "outra-musica.cho"
  }
]
```

## Como executar localmente
Como o projeto utiliza a `Fetch API` para carregar o arquivo `.json`, não é possível rodá-lo apenas abrindo o arquivo `index.html` direto no navegador (isso causa um erro de CORS). Você precisará de um servidor web local.

### Usando Python (Linux/Mac/Windows)
Se você tiver o Python instalado (muito comum em distribuições como Arch Linux), basta rodar no terminal, dentro da pasta do projeto:

```bash
python -m http.server 8000
```

E acessar `http://localhost:8000` no seu navegador.

### Usando o VS Code / VSCodium
1. Instale a extensão **Live Server**.
2. Clique com o botão direito no arquivo `index.html` e selecione "Open with Live Server".

## Licença
Distribuído sob a licença [**MIT**](LICENSE).