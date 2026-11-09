// ==============================================================================
// 1. CONFIGURAÇÕES GERAIS
// ==============================================================================
const NOME_ABA_BANCO = 'Chamados';

// ==============================================================================
// 2. ROTEAMENTO DE TELA (Com Whitelist de Usuários)
// ==============================================================================
// Coloque aqui, entre aspas e separados por vírgula, os e-mails exatos que terão acesso
const EMAILS_AUTORIZADOS = [
  'arthur.ribeiro@tvtem.com',
  'alexsander.taboas@tvtem.com',
  'francisco.berbel@tvtem.com',
  'gabriel.barbosa@tvtem.com',
  'marcio.morais@tvtem.com',
  'nicolas.vieira@tvtem.com',
  'pamela.torres@tvtem.com'
];

function doGet(e) {
  var emailUsuario = Session.getActiveUser().getEmail();
  
  // Condição de Bloqueio: Verifica se o e-mail existe E NÃO ESTÁ na nossa lista permitida
  if (emailUsuario !== "" && !EMAILS_AUTORIZADOS.includes(emailUsuario)) {
    
    // Tela de bloqueio personalizada
    var htmlBloqueio = `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px; color: #333;">
        <h1 style="color: #d9534f;">Acesso Negado</h1>
        <p>Seu usuário não possui permissão para acessar o sistema de gestão de manutenção.</p>
        <p style="color: #666; font-size: 14px;">Tentativa de acesso com: <b>${emailUsuario}</b></p>
        <p>Se você faz parte do setor de manutenção, solicite a liberação ao administrador.</p>
      </div>
    `;
    
    return HtmlService.createHtmlOutput(htmlBloqueio)
        .setTitle('Acesso Negado');
  }

  // Se o e-mail estiver na lista (ou se for o modo de teste interno), carrega o sistema
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('SGM - TV TEM')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1'); 
}

// ==============================================================================
// 3. MOTOR DE CONEXÃO COM O BANCO DE DADOS
// ==============================================================================
function conectarBanco() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(NOME_ABA_BANCO);
  
  if (!aba) {
    throw new Error("Erro Crítico: A aba '" + NOME_ABA_BANCO + "' não foi encontrada no banco de dados.");
  }
  return aba;
}

// ==============================================================================
// 4. FUNÇÃO DE TESTE 
// ==============================================================================
function testarConexao() {
  try {
    var aba = conectarBanco();
    Logger.log("SUCESSO! Conectado ao banco. A aba '" + aba.getName() + "' tem " + aba.getLastRow() + " linha(s) preenchida(s).");
  } catch (erro) {
    Logger.log(erro.message);
  }
}

// ==============================================================================
// 5. MOTOR DE GRAVAÇÃO (CREATE - Abrir Chamado)
// ==============================================================================
function salvarNovoChamado(dadosDoFrontEnd) {
  // 1. Inicia a Catraca de Segurança (Lock)
  var lock = LockService.getScriptLock();
  
  try {
    // Pede para esperar na fila por até 10.000 milissegundos (10 segundos)
    lock.waitLock(10000); 
    
    var aba = conectarBanco();
    var idGerado = 'TICKET #' + new Date().getTime(); 
    var statusInicial = 'Aberto';
    var dataAtual = new Date();
    
    var tecnicoRegistrador = Session.getActiveUser().getEmail();
    if (tecnicoRegistrador === "") tecnicoRegistrador = "central.bauru@tvtem.com"; 
    
    var novaLinha = [
      idGerado, statusInicial, dataAtual, tecnicoRegistrador, 
      dadosDoFrontEnd.solicitante, dadosDoFrontEnd.equipamento, 
      dadosDoFrontEnd.local, dadosDoFrontEnd.defeito, 
      "", "", ""
    ];
    
    aba.appendRow(novaLinha);
    
    // Automação de E-mail (Isolada para não quebrar a catraca se falhar)
    try {
      var emailDestino = "central.bauru@tvtem.com";
      var assunto = "[CHAMADO] " + dadosDoFrontEnd.equipamento;
      var corpoHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #0056b3;">Manutenção Solicitada</h2>
          <div style="background-color: #f4f7f6; padding: 15px; border-radius: 5px; border-left: 4px solid #0056b3;">
            <p><strong>ID:</strong> ${idGerado}</p>
            <p><strong>Equipamento:</strong> ${dadosDoFrontEnd.equipamento}</p>
            <p><strong>Local:</strong> ${dadosDoFrontEnd.local}</p>
            <p><strong>Defeito:</strong> <span style="color: #d9534f;">${dadosDoFrontEnd.defeito}</span></p>
            <p><strong>Solicitante:</strong> ${dadosDoFrontEnd.solicitante}</p>
          </div>
          <p style="font-size: 12px; color: #777; margin-top: 20px;">Registrado por: ${tecnicoRegistrador}</p>
        </div>
      `;
      GmailApp.sendEmail(emailDestino, assunto, "", { htmlBody: corpoHtml, name: "SGM - TV TEM", noReply: true });
    } catch (erroEmail) {
      Logger.log("Erro de e-mail: " + erroEmail.message);
    }
    
    return "SUCESSO";
    
  } catch (erroDeConcorrencia) {
    // Se passar de 10 segundos e a fila não andar, avisa o usuário elegantemente
    throw new Error("O sistema está recebendo muitos acessos simultâneos. Por favor, tente novamente em instantes.");
  } finally {
    // ISSO É VITAL: Terminou ou deu erro? Libera a catraca para o próximo!
    lock.releaseLock();
  }
}

// ==============================================================================
// 6. MOTOR DE LEITURA (READ - Listar Chamados Abertos)
// ==============================================================================
function buscarChamadosAbertos() {
  var aba = conectarBanco();
  var dados = aba.getDataRange().getValues(); 
  var chamadosAbertos = [];
  
  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var status = linha[1]; 
    
    if (status === 'Aberto') {
      
      // Converte a Data nativa do Google para um Texto Seguro
      var dataSegura = "";
      if (linha[2] instanceof Date) {
        dataSegura = Utilities.formatDate(linha[2], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
      } else {
        dataSegura = linha[2]; 
      }
      
      chamadosAbertos.push({
        id: linha[0],           
        data: dataSegura,       
        solicitante: linha[4],  
        equipamento: linha[5],  
        local: linha[6],        
        defeito: linha[7]       
      });
    }
  }
  
  return chamadosAbertos; 
}

// ==============================================================================
// 7. MOTOR DE RESOLUÇÃO (UPDATE - Fechar Chamado)
// ==============================================================================
function resolverChamado(dadosResolucao) {
  var lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(10000); 
    
    var aba = conectarBanco();
    var dados = aba.getDataRange().getValues(); 
    
    var tecnicoSolucionador = Session.getActiveUser().getEmail();
    if (tecnicoSolucionador === "") tecnicoSolucionador = "central.bauru@tvtem.com";
    
    var dataAtual = new Date();
    var idProcurado = dadosResolucao.id;
    var solucao = dadosResolucao.solucao;
    var chamadoEncontrado = false;
    
    for (var i = 1; i < dados.length; i++) {
      var linhaAtual = dados[i];
      if (linhaAtual[0] === idProcurado) {
        var numeroDaLinhaReal = i + 1; 
        
        aba.getRange(numeroDaLinhaReal, 2).setValue('Resolvido');          
        aba.getRange(numeroDaLinhaReal, 9).setValue(dataAtual);            
        aba.getRange(numeroDaLinhaReal, 10).setValue(tecnicoSolucionador); 
        aba.getRange(numeroDaLinhaReal, 11).setValue(solucao);             
        
        chamadoEncontrado = true;
        
        // Automação de E-mail de Resolução
        try {
          var emailDestino = "central.bauru@tvtem.com";
          var assunto = "[RESOLVIDO] " + linhaAtual[5] + " no " + linhaAtual[6];
          var corpoHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #28a745;">Chamado Encerrado</h2>
              <div style="background-color: #f4f7f6; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
                <p><strong>ID:</strong> ${idProcurado}</p>
                <p><strong>Equipamento:</strong> ${linhaAtual[5]}</p>
                <p><strong>Defeito Original:</strong> <span style="color: #666;">${linhaAtual[7]}</span></p>
                <p><strong>Solução Aplicada:</strong> <span style="color: #28a745; font-weight: bold;">${solucao}</span></p>
              </div>
              <p style="font-size: 12px; color: #777; margin-top: 20px;">Resolvido por: ${tecnicoSolucionador}</p>
            </div>
          `;
          GmailApp.sendEmail(emailDestino, assunto, "", { htmlBody: corpoHtml, name: "SGM - TV TEM", noReply: true });
        } catch (erroEmail) {
          Logger.log("Erro e-mail resolução: " + erroEmail.message);
        }
        
        break; // Sai do laço For, pois já achamos o chamado
      }
    }
    
    if (!chamadoEncontrado) {
      throw new Error("Chamado não encontrado na base de dados.");
    }
    
    return "SUCESSO";
    
  } catch (erro) {
    throw new Error("O sistema está ocupado processando outra solicitação. Tente novamente: " + erro.message);
  } finally {
    lock.releaseLock();
  }
}

// ==============================================================================
// 8. MOTOR DE LEITURA (READ - Listar Histórico de Resolvidos)
// ==============================================================================
function buscarChamadosResolvidos() {
  var aba = conectarBanco();
  var dados = aba.getDataRange().getValues(); 
  var chamadosResolvidos = [];
  
  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var status = linha[1]; 
    
    if (status === 'Resolvido') {
      
      // Formata a Data de Abertura
      var dataAberturaSegura = (linha[2] instanceof Date) ? Utilities.formatDate(linha[2], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : linha[2];
      
      // Formata a Data de Resolução (Coluna I, índice 8)
      var dataResolucaoSegura = (linha[8] instanceof Date) ? Utilities.formatDate(linha[8], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : linha[8];
      
      chamadosResolvidos.push({
        id: linha[0],           
        dataAbertura: dataAberturaSegura,       
        solicitante: linha[4],  
        equipamento: linha[5],  
        local: linha[6],        
        defeito: linha[7],
        dataResolucao: dataResolucaoSegura,
        tecnicoSolucionador: linha[9],
        solucao: linha[10]
      });
    }
  }
  
  // O reverse() inverte a lista para que o resolvido mais recentemente fique no topo
  return chamadosResolvidos.reverse(); 
}
