# Luz.IA — Referência visual para implementação

Data: 20/10/2026. Direção visual proposta, complementar à spec de reconstrução. Imagens produzidas com a ferramenta integrada de geração de imagens. Os prompts completos estão em `prompts.json`.

## Como usar

Abra as imagens desta pasta antes de implementar. Reproduza composição, hierarquia, espaçamento e linguagem visual com componentes reais. As imagens são referências, não backgrounds para a página inteira. Regras de negócio e permissões vêm de `../LuzIA-Spec-Reconstrucao.md`.

| Arquivo | Referência |
|---|---|
| 01-catalogo.png | Página inicial do colaborador do Tributário, quatro aplicações autorizadas |
| 02-login.png | Entrada Microsoft, composição dividida |
| 03-relatorios.png | Relatório gerencial, filtros, indicadores, gráficos e tabela |
| 04-administracao.png | Catálogo administrativo e painel lateral de edição |
| 05-aplicacao-mobile.png | Moldura do hub para iframe e catálogo em celular |

## Sistema visual

| Token | Valor |
|---|---|
| Fundo | `#F6F7F8` |
| Superfície | `#FFFFFF` |
| Menu lateral | `#202326` |
| Texto principal | `#24282D` |
| Texto secundário | `#626A74` |
| Borda | `#E5E7EB` |
| Destaque e ação primária | `#F4C542` com texto `#24282D` |
| Destaque suave | `#FFF5D6` |
| Sucesso | texto `#216642`, fundo `#EAF6EF` |
| Erro | texto `#B42318`, fundo `#FFF1F0` |

Usar Inter se disponível localmente ou por carregamento integrado do projeto; fallback `system-ui, sans-serif`. Corpo 14–16 px, descrição 14 px com entrelinha 1,5, título de página 28–32 px/600–700, título de seção 20 px/600. Não usar textos minúsculos para encaixar conteúdo.

Grade de espaçamento: 4, 8, 12, 16, 24, 32 e 40 px. Menu 224 px, cabeçalho 64 px, padding de conteúdo desktop 32 px, distância entre cards 16–24 px. Raios 10–12 px em cards, 8 px em campos e botões. Bordas de 1 px. Sombra sutil apenas quando contribuir à separação das superfícies. Evitar sombras grandes e excesso de arredondamento.

Botões e campos com altura mínima de 44 px. Ícones de traço consistente, preferencialmente da biblioteca já adotada; 18–20 px em controles, 24 px em tiles. Ícones de aplicações são demonstrações: preservar suporte a emoji e upload de capa 3:4 conforme a spec. O tile compacto não substitui o formato de capa quando houver imagem cadastrada.

O símbolo de luz junto à marca é uma proposta gráfica; construir como vetor simples ou ícone e manter o texto Luz.IA real. Não usar a imagem raster da tela como logotipo.

## Regras das telas

### Catálogo

Menu do colaborador contém Aplicações e Novidades. Relatórios aparece apenas para gestores; administração somente para administradores. Duas colunas de cards no desktop. Cada card: ícone, nome, descrição curta, departamento e uma ação inequívoca. Usar uma única seta junto da ação; setas adicionais eventualmente presentes na arte são redundâncias de geração, não exigências.

A saudação não depende de horário nem precisa exibir indicadores gerenciais. O bloco Novidades contém conteúdo editorial cadastrado. Notícias e funcionalidades citadas nas imagens são fictícias e não devem ser anunciadas como existentes.

### Login

Painel escuro editorial à esquerda; painel claro de autenticação à direita. Uma única ação de login Microsoft, sem formulário de senha. Em celular, remover o painel ornamental e manter marca, texto e botão com padding de 24 px. Não colocar ornamentos atrás do texto.

### Relatórios

Filtros antes dos indicadores. Período, departamento e aplicação disponíveis conforme permissão. Três indicadores compactos, gráfico temporal e ranking, seguidos do histórico paginado. Quantidades, nomes e gráficos são amostras sintéticas; implementar com dados reais autorizados ou fixtures explicitamente de desenvolvimento. Não acrescentar variações percentuais sem período comparativo calculado.

Correção da arte: o gerador incluiu Documentos, Tarefas e Calendário no ranking. Esses produtos não fazem parte do escopo. Usar somente aplicações cadastradas; nas fixtures, substituir por PERDCOMP, Boas-vindas e CPA Tax Planner. Não usar as linhas sintéticas da tabela para inferir quais departamentos podem acessar cada aplicação. Os valores do gráfico também não são uma série estatística validada.

### Administração

Tabela de aplicações com estado textual, departamento e ações com rótulo acessível. Painel de edição de 440–480 px no desktop, full-screen em celular. Conteúdo rolável e rodapé de ações fixo dentro do painel. Não permitir que o rodapé cubra os últimos campos. Modal com foco contido, Escape, retorno do foco ao gatilho e aviso antes de descartar alterações.

Campos do painel seguem a spec, mesmo que algum detalhe não caiba na imagem: nome, descrição, URL, ícone/capa, audiência e estado. A URL de exemplo na imagem não é um domínio aprovado de integração.

Reutilizar a linguagem de tabela para colaboradores e departamentos; novidades usa listagem editorial e formulário com título, conteúdo, versão e publicação. Não inventar permissões específicas a partir da imagem.

### Aplicação aberta

Reduzir o chrome para privilegiar o iframe, preservando título e retorno ao catálogo. A área interna cinza/skeleton da arte é apenas uma representação de conteúdo externo; não construir uma nova interface PERDCOMP a partir dela. Em carregamento, oferecer estado textual; em falha, explicar e oferecer tentar novamente.

Correções da arte: o menu desktop ficou expandido; disponibilizar recolhimento para 64 px e preferir esse estado durante o uso do iframe. Remover o texto que afirma “ambiente seguro”: a imagem não comprova segurança da integração. Não implementar botão de tela cheia sem comportamento acessível correspondente. No mobile, manter descrições alinhadas ao catálogo desktop; o gerador resumiu os textos de forma inconsistente.

## Responsividade, temas e estados

- A partir de 1200 px: sidebar fixa e catálogo em duas colunas.
- Entre 768 e 1199 px: sidebar recolhível; reduzir padding para 24 px, ajustar cards conforme espaço disponível.
- Abaixo de 768 px: menu em drawer, padding 16–20 px, cards em coluna, filtros empilhados. Não reduzir tipografia ou comprimir navegação desktop.
- Tabelas podem ter rolagem horizontal contida; página não deve estourar a largura da tela.
- Representar carregamento, vazio, busca sem resultado, falha de carregamento, acesso negado, sucesso de gravação e campos inválidos.
- Foco visível com contorno de 2 px e afastamento; validar contraste, rótulos e navegação por teclado.
- As artes mostram tema claro. Para tema escuro, usar fundo `#17191C`, superfícies `#22262B`, borda `#3A414A`, texto `#F4F5F7`, secundário `#B1B8C1`, mantendo amarelo e texto escuro nos botões. Validar visualmente a variante; ela não está ilustrada em tela completa neste pacote.

## Fidelidade e validação

1. Implementar primeiro o shell e o catálogo com fixtures sintéticas.
2. Comparar screenshot em viewport desktop 1440×1000 com a referência, considerando que imagens geradas podem ter dimensões diferentes.
3. Conferir menu, largura útil, margens, hierarquia, cores e densidade antes de replicar o padrão nas outras telas.
4. Validar catálogo e formulário em 390×844, sem overflow.
5. Manter textos e controles reais; corrigir eventuais erros de escrita ou artefatos dos mockups. Este guia é a referência exata para medidas e textos funcionais; a spec determina comportamento e segurança.

## Prompt para Claude Code

> Leia `LuzIA-Spec-Reconstrucao.md` e `mockups/GUIA-VISUAL-CLAUDE-CODE.md`. Abra e examine todas as imagens em `mockups/`. Refatore a interface para seguir essa direção visual: menu chumbo, superfícies claras, amarelo pontual, tipografia consistente e componentes compactos. Comece por shell e catálogo, compare capturas desktop e mobile e depois aplique o padrão a login, relatórios e administração. Preserve a lógica e as integrações válidas. Não use screenshots como interface nem invente funcionalidades a partir dos dados fictícios. Respeite as regras de autorização e os estados descritos na spec. Informe diferenças remanescentes entre implementação e referência.
