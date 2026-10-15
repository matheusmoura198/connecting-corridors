// ---------- Qual assessoria é esta página? ----------
const parametros = new URLSearchParams(window.location.search)

// A equipe é descoberta em iniciar(), depois que a lista de equipes carrega
let equipe = null

// Eu sou aluno desta assessoria? Eu sou o treinador (ou o admin)?
let ehAluno = false
let ehTreinador = false


// ---------- Elementos da página ----------
const pagina = document.getElementById("pagina")
const botaoSair = document.getElementById("botao-sair")
const linkAreaAlunos = document.getElementById("link-area-alunos")
const linkGestao = document.getElementById("link-gestao")

const equipeFoto = document.getElementById("equipe-foto")
const equipeTitulo = document.getElementById("equipe-titulo")
const equipeSituacao = document.getElementById("equipe-situacao")
const botaoSolicitar = document.getElementById("botao-solicitar")
const msgEquipe = document.getElementById("msg-equipe")

const textoApresentacao = document.getElementById("texto-apresentacao")
const blocoServicos = document.getElementById("bloco-servicos")
const listaServicos = document.getElementById("lista-servicos")
const contatos = document.getElementById("contatos")
const areaApresentacao = document.getElementById("area-apresentacao")
const formApresentacao = document.getElementById("form-apresentacao")
const campoApresentacao = document.getElementById("apresentacao-campo")
const campoServicos = document.getElementById("servicos-campo")
const campoWhatsapp = document.getElementById("whatsapp-campo")
const campoInstagram = document.getElementById("instagram-campo")
const msgApresentacao = document.getElementById("msg-apresentacao")
const botaoSalvarApresentacao = document.getElementById("botao-salvar-apresentacao")

const areaAlunos = document.getElementById("area-alunos")
const abaTreinos = document.getElementById("aba-treinos")
const abaPublicacoes = document.getElementById("aba-publicacoes")

const gestao = document.getElementById("gestao")
const listaPedidos = document.getElementById("lista-pedidos")
const semPedidos = document.getElementById("sem-pedidos")
const totalAlunos = document.getElementById("total-alunos")
const listaAlunos = document.getElementById("lista-alunos")


// ---------- Começo: confere o login e monta a página ----------
async function iniciar() {
  perfil = await obterPerfilLogado()

  if (!perfil) {
    guardarDestino(window.location.href)
    window.location.href = "index.html"
    return
  }

  await carregarEquipes()
  equipe = equipePorSlug(parametros.get("equipe"))

  if (!equipe) {
    window.location.href = "index.html#equipes"
    return
  }

  // Equipes comuns têm outra página
  if (equipe.tipo !== "assessoria") {
    window.location.replace(enderecoDaEquipe(equipe))
    return
  }

  ehAluno = perfil.equipe === equipe.nome
  ehTreinador = perfil.papel === "admin" || (perfil.papel === "lider" && ehAluno)

  pagina.hidden = false
  montarTopo()
  montarApresentacao()

  areaAviso.hidden = !ehTreinador
  areaApresentacao.hidden = !ehTreinador

  if (ehAluno || ehTreinador) {
    // Aviso, treinos e publicações: só para os alunos e o treinador
    mostrarAviso()
    areaAlunos.hidden = false
    linkAreaAlunos.hidden = false
    abrirAba("treino")
  }

  if (ehTreinador) {
    gestao.hidden = false
    linkGestao.hidden = false
    await mostrarGestao()
  } else if (!ehAluno && perfil.papel === "integrante") {
    await verificarPedido()
  }
}


// ---------- Capa e situação da pessoa ----------
function montarTopo() {
  document.title = equipe.nome + " | Runners Conecting"
  equipeTitulo.textContent = equipe.nome

  // Se a logo ainda não existir, fica só o fundo azul com o nome
  equipeFoto.addEventListener("error", function () {
    equipeFoto.hidden = true
  })
  if (equipe.foto) {
    equipeFoto.src = equipe.foto
    equipeFoto.alt = "Logo da " + equipe.nome
  } else {
    equipeFoto.hidden = true
  }

  if (ehTreinador && !ehAluno) {
    equipeSituacao.textContent = "Você é admin: pode gerenciar esta assessoria."
  } else if (ehTreinador) {
    equipeSituacao.textContent = "Você é o treinador desta assessoria."
  } else if (ehAluno) {
    equipeSituacao.textContent = "Você é aluno desta assessoria."
  } else if (perfil.papel === "integrante") {
    equipeSituacao.textContent = "Os treinos e as publicações são exclusivos dos alunos. Para participar, peça a sua entrada: o treinador analisa o pedido."
  } else {
    equipeSituacao.textContent = "Os treinos e as publicações são exclusivos dos alunos."
  }
}

// Pedido de entrada: mostra o botão, ou diz que o pedido já foi enviado
async function verificarPedido() {
  const resposta = await cliente
    .from("solicitacoes")
    .select("id")
    .eq("equipe", equipe.nome)
    .eq("user_id", perfil.id)

  if (resposta.error) {
    console.error("Erro ao verificar o pedido de entrada:", resposta.error)
    return
  }

  botaoSolicitar.hidden = false
  if (resposta.data.length > 0) {
    marcarPedidoEnviado()
  }
}

function marcarPedidoEnviado() {
  botaoSolicitar.disabled = true
  botaoSolicitar.textContent = "Pedido enviado"
  msgEquipe.classList.add("ok")
  msgEquipe.textContent = "O treinador vai analisar o seu pedido. Quando ele aprovar, a área dos alunos abre para você."
}

botaoSolicitar.addEventListener("click", async function () {
  if (perfil.equipe) {
    const aviso =
      "Você faz parte da " + perfil.equipe + ". Se o treinador aceitar o pedido, você sai dela e passa a ser aluno da assessoria. Continuar?"
    if (!window.confirm(aviso)) {
      return
    }
  }

  msgEquipe.classList.remove("ok")
  msgEquipe.textContent = ""
  ocupado(botaoSolicitar, true, "Solicitar entrada na assessoria")

  const resposta = await cliente.from("solicitacoes").insert({ equipe: equipe.nome })

  if (resposta.error) {
    console.error("Erro ao pedir entrada:", resposta.error)
    ocupado(botaoSolicitar, false, "Solicitar entrada na assessoria")
    msgEquipe.textContent = "Não foi possível enviar o pedido. Tente de novo."
    return
  }

  marcarPedidoEnviado()
})


// ---------- Apresentação, serviços e contatos ----------

// 5562981484988 vira (62) 98148-4988
function formatarTelefone(digitos) {
  let numero = digitos
  if (numero.startsWith("55") && numero.length >= 12) {
    numero = numero.slice(2)
  }
  if (numero.length === 11) {
    return "(" + numero.slice(0, 2) + ") " + numero.slice(2, 7) + "-" + numero.slice(7)
  }
  if (numero.length === 10) {
    return "(" + numero.slice(0, 2) + ") " + numero.slice(2, 6) + "-" + numero.slice(6)
  }
  return digitos
}

// Aceita "@usuario", "usuario" ou o link do perfil. Devolve só o usuário,
// "" se estiver vazio, ou null se não parecer um usuário válido.
function limparInstagram(texto) {
  let usuario = texto.trim()
  usuario = usuario.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
  usuario = usuario.replace(/^@/, "")
  usuario = usuario.split(/[/?#]/)[0]

  if (usuario === "") {
    return ""
  }
  return /^[A-Za-z0-9._]{1,30}$/.test(usuario) ? usuario : null
}

function montarApresentacao() {
  textoApresentacao.textContent = equipe.apresentacao || "O treinador ainda não preencheu a apresentação."

  // Serviços: um por linha
  const servicos = (equipe.servicos || "")
    .split("\n")
    .map(function (linha) {
      return linha.trim()
    })
    .filter(function (linha) {
      return linha !== ""
    })

  listaServicos.innerHTML = ""
  blocoServicos.hidden = servicos.length === 0
  servicos.forEach(function (servico) {
    listaServicos.appendChild(criarElemento("li", "", servico))
  })

  // Contatos
  contatos.innerHTML = ""

  if (equipe.whatsapp) {
    const mensagem = "Olá! Vi a " + equipe.nome + " no Runners Conecting e quero saber mais sobre a assessoria."
    const whatsapp = criarElemento("a", "botao", "Falar com o treinador no WhatsApp")
    whatsapp.href = "https://wa.me/" + equipe.whatsapp + "?text=" + encodeURIComponent(mensagem)
    whatsapp.target = "_blank"
    whatsapp.rel = "noopener noreferrer"
    contatos.appendChild(whatsapp)
  }

  if (equipe.instagram) {
    const instagram = criarElemento("a", "botao botao-contorno", "Ver o Instagram")
    instagram.href = "https://instagram.com/" + equipe.instagram
    instagram.target = "_blank"
    instagram.rel = "noopener noreferrer"
    contatos.appendChild(instagram)
  }

  if (equipe.whatsapp) {
    contatos.appendChild(criarElemento("p", "contato-texto", "WhatsApp: " + formatarTelefone(equipe.whatsapp)))
  }
  if (equipe.instagram) {
    contatos.appendChild(criarElemento("p", "contato-texto", "Instagram: @" + equipe.instagram))
  }

  // Formulário do treinador, já preenchido com o que está salvo
  campoApresentacao.value = equipe.apresentacao || ""
  campoServicos.value = equipe.servicos || ""
  campoWhatsapp.value = equipe.whatsapp ? formatarTelefone(equipe.whatsapp) : ""
  campoInstagram.value = equipe.instagram || ""
}

formApresentacao.addEventListener("submit", async function (evento) {
  evento.preventDefault()

  const apresentacao = campoApresentacao.value.trim()
  const servicos = campoServicos.value
    .split("\n")
    .map(function (linha) {
      return linha.trim()
    })
    .filter(function (linha) {
      return linha !== ""
    })
    .join("\n")

  // WhatsApp: só números, com o código do país (55) na frente
  let whatsapp = campoWhatsapp.value.replace(/\D/g, "")
  if (whatsapp.length === 10 || whatsapp.length === 11) {
    whatsapp = "55" + whatsapp
  }
  if (whatsapp !== "" && (whatsapp.length < 12 || whatsapp.length > 15)) {
    msgApresentacao.textContent = "Digite o WhatsApp com DDD, por exemplo (62) 98148-4988."
    return
  }

  const instagram = limparInstagram(campoInstagram.value)
  if (instagram === null) {
    msgApresentacao.textContent = "Digite só o usuário do Instagram (ex.: equipe_campos_running) ou o link do perfil."
    return
  }

  msgApresentacao.textContent = ""
  ocupado(botaoSalvarApresentacao, true, "Salvar")

  // O ".select()" devolve as linhas alteradas: se vier vazio, o banco não permitiu
  const resposta = await cliente
    .from("equipes")
    .update({
      apresentacao: apresentacao,
      servicos: servicos,
      whatsapp: whatsapp,
      instagram: instagram
    })
    .eq("nome", equipe.nome)
    .select()

  ocupado(botaoSalvarApresentacao, false, "Salvar")

  if (resposta.error || !resposta.data || resposta.data.length === 0) {
    console.error("Erro ao salvar a apresentação:", resposta.error)
    msgApresentacao.textContent = "Não foi possível salvar. Tente de novo."
    return
  }

  await carregarEquipes()
  equipe = equipePorSlug(equipe.slug)
  montarApresentacao()
  areaApresentacao.open = false
})


// ---------- Área dos alunos: abas Treinos e Publicações ----------
function abrirAba(tipo) {
  const treino = tipo === "treino"
  abaTreinos.setAttribute("aria-selected", String(treino))
  abaPublicacoes.setAttribute("aria-selected", String(!treino))
  iniciarMural(equipe.nome, { tipo: tipo, somenteTreinador: true })
}

abaTreinos.addEventListener("click", function () {
  abrirAba("treino")
})

abaPublicacoes.addEventListener("click", function () {
  abrirAba("publicacao")
})


// ---------- Gestão do treinador: pedidos de entrada e alunos ----------
async function mostrarGestao() {
  await mostrarPedidos()
  await mostrarAlunos()
}

async function mostrarPedidos() {
  const resposta = await cliente
    .from("solicitacoes")
    .select("id, user_id, criado_em, profiles!solicitacoes_user_id_fkey(nome)")
    .eq("equipe", equipe.nome)
    .order("criado_em", { ascending: true })

  listaPedidos.innerHTML = ""

  if (resposta.error) {
    console.error("Erro ao carregar os pedidos de entrada:", resposta.error)
    semPedidos.textContent = "Não foi possível carregar os pedidos agora."
    semPedidos.hidden = false
    return
  }

  semPedidos.textContent = "Nenhum pedido de entrada no momento."
  semPedidos.hidden = resposta.data.length > 0

  resposta.data.forEach(function (pedido) {
    listaPedidos.appendChild(criarLinhaDePedido(pedido))
  })
}

function criarLinhaDePedido(pedido) {
  const linha = criarElemento("div", "gestao-item")

  const info = criarElemento("div", "gestao-info")
  info.appendChild(criarElemento("p", "gestao-nome", pedido.profiles ? pedido.profiles.nome : "Usuário"))
  info.appendChild(criarElemento("p", "gestao-detalhe", "Pediu entrada em " + formatarData(pedido.criado_em)))
  linha.appendChild(info)

  const acoes = criarElemento("div", "gestao-acoes")

  const aprovar = criarElemento("button", "botao botao-pequeno", "Aprovar")
  aprovar.type = "button"
  aprovar.addEventListener("click", async function () {
    aprovar.disabled = true
    const resposta = await cliente.rpc("aprovar_aluno", { p_solicitacao: pedido.id })
    if (resposta.error) {
      console.error("Erro ao aprovar o aluno:", resposta.error)
      aprovar.disabled = false
      window.alert("Não foi possível aprovar o pedido. Tente de novo.")
      return
    }
    await mostrarGestao()
  })

  const recusar = criarElemento("button", "botao-texto botao-texto-perigo", "Recusar")
  recusar.type = "button"
  recusar.addEventListener("click", async function () {
    if (!window.confirm("Recusar o pedido de entrada?")) {
      return
    }
    const resposta = await cliente.from("solicitacoes").delete().eq("id", pedido.id)
    if (resposta.error) {
      window.alert("Não foi possível recusar o pedido. Tente de novo.")
      return
    }
    await mostrarGestao()
  })

  acoes.appendChild(aprovar)
  acoes.appendChild(recusar)
  linha.appendChild(acoes)
  return linha
}

async function mostrarAlunos() {
  const resposta = await cliente
    .from("profiles")
    .select("id, nome, papel")
    .eq("equipe", equipe.nome)
    .order("nome", { ascending: true })

  listaAlunos.innerHTML = ""

  if (resposta.error) {
    console.error("Erro ao carregar os alunos:", resposta.error)
    totalAlunos.textContent = "Não foi possível carregar os alunos agora."
    return
  }

  const alunos = resposta.data.filter(function (pessoa) {
    return pessoa.papel === "integrante"
  })

  if (alunos.length === 0) {
    totalAlunos.textContent = "Ainda não há alunos. Aprove os pedidos de entrada para os alunos aparecerem aqui."
  } else if (alunos.length === 1) {
    totalAlunos.textContent = "1 aluno"
  } else {
    totalAlunos.textContent = alunos.length + " alunos"
  }

  alunos.forEach(function (aluno) {
    const linha = criarElemento("div", "gestao-item")
    linha.appendChild(criarElemento("p", "gestao-nome", aluno.nome))

    const remover = criarElemento("button", "botao-texto botao-texto-perigo", "Remover")
    remover.type = "button"
    remover.addEventListener("click", async function () {
      if (!window.confirm("Remover " + aluno.nome + " da assessoria? A conta dele continua existindo.")) {
        return
      }
      const resultado = await cliente.rpc("remover_aluno", { p_user: aluno.id })
      if (resultado.error) {
        console.error("Erro ao remover o aluno:", resultado.error)
        window.alert("Não foi possível remover o aluno. Tente de novo.")
        return
      }
      await mostrarGestao()
    })
    linha.appendChild(remover)

    listaAlunos.appendChild(linha)
  })
}


// ---------- Sair ----------
botaoSair.addEventListener("click", async function () {
  await cliente.auth.signOut()
  window.location.href = "index.html"
})


iniciar()
