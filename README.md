# 🛠️ Sistema de Help-Desk (Manutenção Técnica)

![Status do Projeto](https://img.shields.io/badge/Status-Produção_v1.0.0-success)
![Google Apps Script](https://img.shields.io/badge/Google_Apps_Script-Serverless-4285F4?logo=google)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript)

> **Nota:** Adicione aqui um print do sistema rodando usando o código abaixo:
> `![Painel do Sistema](./assets/painel-aberto.png)`

## 1. Visão Geral do Projeto
O **Help-Desk de Manutenção** é uma aplicação web (Single Page Application - SPA) desenvolvida para gerenciar o ciclo de vida de chamados técnicos de equipes de engenharia/manutenção. O foco do sistema é agilidade no registro mobile, acompanhamento em tempo real e automação de notificações, operando 100% no ecossistema do Google Workspace.

## 2. Arquitetura do Sistema
O projeto utiliza uma arquitetura **Serverless**, eliminando custos de hospedagem de servidores:
*   **Front-end (Interface):** HTML5, CSS3 e Vanilla JavaScript. Construído como uma SPA para transições de tela fluidas sem recarregamento.
*   **Back-end (Lógica/API):** Google Apps Script (GAS) atuando como motor de roteamento e regras de negócio.
*   **Banco de Dados:** Google Sheets (Aba `Chamados`).
*   **Autenticação:** Nativa via Google Session (SSO do Google Workspace).

## 3. Regras de Negócio e Segurança Corporativa
Para garantir a integridade dos dados e o uso exclusivo corporativo, o sistema conta com as seguintes blindagens:

*   **Controle de Concorrência (LockService):** Impede a perda de dados caso dois usuários tentem salvar um chamado no exato mesmo milissegundo. A aplicação enfileira as requisições na memória por até 10 segundos.
*   **Bloqueio de Acesso (Whitelist/Domínio):** A renderização da interface verifica a identidade do usuário na porta de entrada (`doGet`). E-mails não autorizados ou fora do domínio corporativo recebem uma tela de "Acesso Negado", bloqueando até mesmo a injeção do HTML principal.
*   **Notificações Autenticadas (GmailApp):** Disparo de e-mails dinâmicos na Abertura e Resolução de chamados. Utiliza a técnica de "Ilusão de No-Reply", alterando o *Display Name* para o nome do sistema e o *Reply-To* para o buraco negro corporativo (`no-reply@...`).
*   **Toast Notifications UI:** Alertas de interações nativas do navegador (`alert()`) foram substituídos por notificações flutuantes (Toasts) assíncronas.

## 4. Estrutura do Banco de Dados (Google Sheets)
A persistência de dados ocorre de forma posicional na aba `Chamados`. 

| Col | Campo | Tipo de Dado | Descrição |
| :--- | :--- | :--- | :--- |
| **A** | ID | `String` | Identificador único do chamado (Ex: `CHM-123456789`). |
| **B** | Status | `String` | `Aberto` ou `Resolvido`. |
| **C** | Data de Abertura | `Date` | Timestamp automático da criação. |
| **D** | Técnico Registrador | `E-mail` | Capturado automaticamente da sessão. |
| **E** | Solicitante | `String` | Nome de quem relatou o problema. |
| **F** | Equipamento | `String` | Modelo ou nome do equipamento avariado. |
| **G** | Local / Setor | `String` | Estúdio, ilha ou local físico. |
| **H** | Defeito Relatado | `String` | Descrição técnica do problema. |
| **I** | Data de Resolução | `Date` | Timestamp automático do fechamento (Update). |
| **J** | Técnico Solucionador| `E-mail` | Capturado da sessão na hora do fechamento. |
| **K** | Solução Aplicada | `String` | Descrição técnica do conserto. |

## 5. Dicionário de Funções e Métodos (API Interna)

### Back-end (`codigo.js` / `.gs`)
*   `doGet(e)`: Porta de entrada nativa do GAS. Aplica as regras de bloqueio e renderiza o Front-end.
*   `conectarBanco()`: Estabelece o elo com o Google Sheets, contendo trava estrutural de erro crítico caso a aba seja renomeada.
*   `salvarNovoChamado(dados)`: Motor CREATE. Enfileira a gravação via `LockService`, gera UUID, grava via `appendRow()` e dispara e-mail em bloco `try...catch` isolado.
*   `buscarChamadosAbertos()`: Motor READ ativo. Varre a matriz de dados e retorna JSON com chamados `Aberto`. Formata o objeto `Date` nativo para envio web.
*   `resolverChamado(dados)`: Motor UPDATE. Protegido por `LockService`. Localiza o ID, insere o diagnóstico, carimbo de tempo, e-mail do técnico e dispara notificação de conclusão.
*   `buscarChamadosResolvidos()`: Motor READ histórico. Retorna JSON com chamados `Resolvido`, aplicando método `.reverse()` para ordenação cronológica decrescente.

### Front-end (`index.html`)
*   `mudarTela(idTela)`: Manipulação do DOM para controle das rotas da SPA.
*   `mostrarNotificacao(msg, tipo)`: Motor visual de injeção de Toasts de sucesso ou erro (com `setTimeout`).
*   `enviarDados...()`: Interceptadores de formulário. Bloqueiam duplo-clique (Spam) e enviam pacotes JSON para o Back-end utilizando a API nativa `google.script.run`.
*   `desenharCards...()`: Manipulação literal de HTML para construção visual da lista de chamados via interpolação de variáveis.

## 6. Como Instalar e Configurar (Setup)
Caso queira replicar este projeto no seu próprio Google Workspace:

1. Crie uma nova planilha no Google Sheets e renomeie a primeira aba para `Chamados`.
2. Adicione os cabeçalhos das colunas (de A até K) conforme a seção 4 desta documentação.
3. Acesse `Extensões > Apps Script`.
4. Copie o conteúdo do arquivo `codigo.js` deste repositório e cole no arquivo `Código.gs` do editor.
5. Crie um novo arquivo HTML chamado `index.html` no editor do Google e cole o conteúdo correspondente deste repositório.
6. Edite a variável `EMAILS_AUTORIZADOS` no `Código.gs` para incluir o seu e-mail do Google.
7. Clique em **Implantar > Nova implantação**, escolha o tipo **App da Web**, defina o acesso para *Sua Organização* ou *Qualquer pessoa* e publique.
