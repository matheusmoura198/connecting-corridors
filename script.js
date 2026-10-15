// ---------- Elementos da página ----------
const telaLogin = document.getElementById("tela-login")
const telaSite = document.getElementById("tela-site")

const abaEntrar = document.getElementById("aba-entrar")
const abaCriar = document.getElementById("aba-criar")
const formEntrar = document.getElementById("form-entrar")
const formCriar = document.getElementById("form-criar")
const msgEntrar = document.getElementById("msg-entrar")
const msgCriar = document.getElementById("msg-criar")

const botaoSair = document.getElementById("botao-sair")
const nomeUsuario = document.getElementById("nome-usuario")

const botaoMinhaEquipe = document.getElementById("botao-minha-equipe")
const painelTreinoConteudo = document.getElementById("painel-treino-conteudo")

const avisoHome = document.getElementById("aviso-home")
const avisoHomeTitulo = document.getElementById("aviso-home-titulo")
const avisoHomeTexto = document.getElementById("aviso-home-texto")
const avisoHomeLink = document.getElementById("aviso-home-link")

const gradeEquipes = document.getElementById("equipes-grade")
const avisoEquipe = document.getElementById("aviso-equipe")


const formSugestao = document.getElementById("form-sugestao")
const sugestaoTexto = document.getElementById("sugestao-texto")
const msgSugestao = document.getElementById("msg-sugestao")


// ---------- Mostrar a tela certa ----------
function mostrarLogin() {
  telaLogin.hidden = false
  telaSite.hidden = true
}

async function mostrarTela() {
  if (!cliente) {
    const aviso =
      "O site ainda não está conectado ao Supabase. Preencha o arquivo supabase-config.js."
    msgEntrar.textContent = aviso
    msgCriar.textContent = aviso
    formEntrar.querySelector("button[type=submit]").disabled = true
    formCriar.querySelector("button[type=submit]").disabled = true
    mostrarLogin()
    return
  }

  const resposta = await cliente.auth.getSession()
  const sessao = resposta.data.session

  perfil = sessao ? await carregarPerfil(sessao.user.id) : null

  if (!perfil) {
    if (sessao) {
      await cliente.auth.signOut()
    }
    mostrarLogin()
    return
  }

  // Se a pessoa chegou por um link (ex.: treino compartilhado no WhatsApp),
  // depois do login ela volta para a página do link.
  const destino = pegarDestino()
  if (destino) {
    window.location.href = destino
    return
  }

  telaLogin.hidden = true
  telaSite.hidden = false
  nomeUsuario.textContent = perfil.nome
  await carregarEquipes()
  desenharEquipes()
  marcarEquipe(perfil.equipe)
  mostrarAvisoNaHome()
  atualizarBotaoMinhaEquipe()
  mostrarProximoTreino()
  iniciarMural(null)
  iniciarDuvidas(null)
}


// ---------- Login e cadastro ----------
function trocarAba(aba) {
  const entrando = aba === "entrar"

  formEntrar.hidden = !entrando
  formCriar.hidden = entrando
  abaEntrar.setAttribute("aria-selected", String(entrando))
  abaCriar.setAttribute("aria-selected", String(!entrando))
  msgEntrar.classList.remove("ok")
  msgEntrar.textContent = ""
  msgCriar.textContent = ""
}

// Links da apresentação ("Criar minha conta", "Entrar") já abrem a aba certa
document.querySelectorAll("[data-aba]").forEach(function (link) {
  link.addEventListener("click", function () {
    trocarAba(link.dataset.aba)
  })
})

abaEntrar.addEventListener("click", function () {
  trocarAba("entrar")
})

abaCriar.addEventListener("click", function () {
  trocarAba("criar")
})

formCriar.addEventListener("submit", async function (evento) {
  evento.preventDefault()
  if (!cliente) {
    return
  }

  const botao = formCriar.querySelector("button[type=submit]")
  const nome = document.getElementById("criar-nome").value.trim()
  const email = document.getElementById("criar-email").value.trim().toLowerCase()
  const senha = document.getElementById("criar-senha").value

  if (nome.length < 3) {
    msgCriar.textContent = "O nome de usuário precisa ter pelo menos 3 caracteres."
    return
  }
  if (email === "" || !email.includes("@")) {
    msgCriar.textContent = "Digite um email válido."
    return
  }
  if (senha.length < 6) {
    msgCriar.textContent = "A senha precisa ter pelo menos 6 caracteres."
    return
  }
  if (!document.getElementById("criar-aceite").checked) {
    msgCriar.textContent = "Marque a caixa para aceitar os termos e a política de privacidade."
    return
  }

  msgCriar.textContent = ""
  ocupado(botao, true, "Criar conta")

  // 1. O nome de usuário está livre?
  const disponivel = await cliente.rpc("nome_disponivel", { n: nome })
  if (disponivel.error) {
    msgCriar.textContent = mensagemDeErro(disponivel.error)
    ocupado(botao, false, "Criar conta")
    return
  }
  if (disponivel.data === false) {
    msgCriar.textContent = "Esse nome de usuário já está em uso. Escolha outro."
    ocupado(botao, false, "Criar conta")
    return
  }

  // 2. Cria a conta (o perfil é criado sozinho pelo banco de dados)
  const resposta = await cliente.auth.signUp({
    email: email,
    password: senha,
    options: { data: { nome: nome } }
  })

  ocupado(botao, false, "Criar conta")

  if (resposta.error) {
    msgCriar.textContent = mensagemDeErro(resposta.error)
    return
  }

  formCriar.reset()

  // Se o Supabase pede confirmação por email, ainda não há sessão
  if (!resposta.data.session) {
    trocarAba("entrar")
    msgEntrar.classList.add("ok")
    msgEntrar.textContent =
      "Conta criada. Enviamos uma mensagem para o seu email: confirme e depois entre."
    return
  }

  await mostrarTela()
  window.scrollTo(0, 0)
})

formEntrar.addEventListener("submit", async function (evento) {
  evento.preventDefault()
  if (!cliente) {
    return
  }

  const botao = formEntrar.querySelector("button[type=submit]")
  const email = document.getElementById("entrar-email").value.trim().toLowerCase()
  const senha = document.getElementById("entrar-senha").value

  msgEntrar.classList.remove("ok")
  msgEntrar.textContent = ""
  ocupado(botao, true, "Entrar")

  const resposta = await cliente.auth.signInWithPassword({
    email: email,
    password: senha
  })

  ocupado(botao, false, "Entrar")

  if (resposta.error) {
    msgEntrar.textContent = mensagemDeErro(resposta.error)
    return
  }

  formEntrar.reset()
  await mostrarTela()
  window.scrollTo(0, 0)
})

botaoSair.addEventListener("click", async function () {
  await cliente.auth.signOut()
  perfil = null
  trocarAba("entrar")
  mostrarLogin()
  window.scrollTo(0, 0)
})


// ---------- Próximo treino da equipe ----------

function atualizarBotaoMinhaEquipe() {
  const minhaEquipe = EQUIPES.find(function (equipe) {
    return equipe.nome === perfil.equipe
  })

  if (minhaEquipe) {
    botaoMinhaEquipe.textContent = ehAssessoria(minhaEquipe)
      ? "Abrir a página da minha assessoria"
      : "Abrir a página da minha equipe"
    botaoMinhaEquipe.href = enderecoDaEquipe(minhaEquipe)
  } else {
    botaoMinhaEquipe.textContent = "Escolher minha equipe"
    botaoMinhaEquipe.href = "#equipes"
  }
}

// Mostra, logo na página inicial, o próximo treino da equipe da pessoa
async function mostrarProximoTreino() {
  painelTreinoConteudo.innerHTML = ""

  const minhaEquipe = EQUIPES.find(function (equipe) {
    return equipe.nome === perfil.equipe
  })

  if (!minhaEquipe) {
    painelTreinoConteudo.appendChild(criarElemento("p", "vazio", "Escolha a sua equipe para ver os próximos treinos."))
    return
  }

  // Na assessoria os treinos são orientações e planilhas do treinador (não têm dia e horário)
  if (ehAssessoria(minhaEquipe)) {
    painelTreinoConteudo.appendChild(
      criarElemento("p", "vazio", "Os treinos da assessoria ficam na área dos alunos, com as orientações e a planilha do treinador.")
    )
    const ir = criarElemento("a", "botao botao-pequeno", "Ver treinos da assessoria")
    ir.href = "assessoria.html?equipe=" + minhaEquipe.slug + "#area-alunos"
    painelTreinoConteudo.appendChild(ir)
    return
  }

  const resposta = await cliente
    .from("treinos")
    .select("id, dia, horario, local_saida, tipo, observacao, presencas(user_id)")
    .eq("equipe", minhaEquipe.nome)
    .gte("dia", dataDeHoje())
    .order("dia", { ascending: true })
    .order("horario", { ascending: true })
    .limit(1)

  if (resposta.error) {
    console.error("Erro ao carregar o próximo treino:", resposta.error)
    painelTreinoConteudo.appendChild(criarElemento("p", "vazio", "Não foi possível carregar o próximo treino agora."))
    return
  }

  if (resposta.data.length === 0) {
    painelTreinoConteudo.appendChild(criarElemento("p", "vazio", "Sua equipe ainda não marcou o próximo treino."))
    return
  }

  painelTreinoConteudo.appendChild(criarCartaoDoProximoTreino(resposta.data[0], minhaEquipe))
}

function criarCartaoDoProximoTreino(treino, minhaEquipe) {
  const cartao = criarElemento("article", "treino")

  const quando = criarElemento("div", "treino-quando")
  quando.appendChild(criarElemento("p", "treino-dia", formatarDiaDoTreino(treino.dia)))
  quando.appendChild(criarElemento("p", "treino-horario", formatarHorario(treino.horario)))
  cartao.appendChild(quando)

  const detalhes = criarElemento("div", "treino-detalhes")
  detalhes.appendChild(criarElemento("p", "treino-local", "Saída: " + treino.local_saida))
  if (treino.tipo) {
    detalhes.appendChild(criarElemento("p", "treino-tipo", treino.tipo))
  }
  if (treino.observacao) {
    detalhes.appendChild(criarElemento("p", "treino-obs", treino.observacao))
  }
  cartao.appendChild(detalhes)

  // "Eu vou" direto da página inicial
  const presencas = treino.presencas || []
  const euVou = presencas.some(function (presenca) {
    return presenca.user_id === perfil.id
  })

  const presenca = criarElemento("div", "treino-presenca")
  const botaoVou = criarElemento("button", "botao-vou", euVou ? "Confirmado" : "Eu vou")
  botaoVou.type = "button"
  botaoVou.setAttribute("aria-pressed", String(euVou))
  botaoVou.addEventListener("click", async function () {
    botaoVou.disabled = true

    let resultado
    if (euVou) {
      resultado = await cliente
        .from("presencas")
        .delete()
        .eq("treino_id", treino.id)
        .eq("user_id", perfil.id)
    } else {
      resultado = await cliente.from("presencas").insert({ treino_id: treino.id })
    }

    if (resultado.error) {
      window.alert("Não foi possível salvar sua presença. Tente de novo.")
    }
    await mostrarProximoTreino()
  })
  presenca.appendChild(botaoVou)

  const total = presencas.length === 1 ? "1 pessoa vai" : presencas.length + " pessoas vão"
  presenca.appendChild(criarElemento("p", "treino-contagem", total))
  cartao.appendChild(presenca)

  const acoes = criarElemento("div", "treino-acoes")
  const link = criarElemento("a", "botao-texto", "Abrir a página da equipe")
  link.href = enderecoDaEquipe(minhaEquipe) + "#treinos"
  acoes.appendChild(link)
  cartao.appendChild(acoes)

  return cartao
}


// ---------- Aviso do líder na página inicial ----------

// Mostra, no topo, o aviso fixado pelo líder da equipe da própria pessoa
function mostrarAvisoNaHome() {
  const minhaEquipe = EQUIPES.find(function (equipe) {
    return equipe.nome === perfil.equipe
  })

  if (!minhaEquipe || !minhaEquipe.aviso) {
    avisoHome.hidden = true
    return
  }

  avisoHomeTitulo.textContent =
    (ehAssessoria(minhaEquipe) ? "Aviso do treinador da " : "Aviso do líder da ") + minhaEquipe.nome
  avisoHomeTexto.textContent = minhaEquipe.aviso
  avisoHomeLink.href = enderecoDaEquipe(minhaEquipe)
  avisoHome.hidden = false
}


// ---------- Escolha da equipe ----------

// Cria um quadro clicável para cada equipe que existe na tabela "equipes"
function desenharEquipes() {
  gradeEquipes.innerHTML = ""

  EQUIPES.forEach(function (equipe) {
    const tile = document.createElement("button")
    tile.type = "button"
    tile.className = "equipe-tile"
    tile.dataset.equipe = equipe.nome
    tile.dataset.slug = equipe.slug
    tile.setAttribute("aria-pressed", "false")

    // Se a foto não existir, esconde a imagem quebrada e deixa
    // aparecer o fundo azul com o nome da equipe.
    if (equipe.foto) {
      const imagem = document.createElement("img")
      imagem.alt = "Foto da " + equipe.nome
      imagem.addEventListener("error", function () {
        imagem.hidden = true
      })
      imagem.src = equipe.foto
      tile.appendChild(imagem)
    }

    const selo = document.createElement("span")
    selo.className = "equipe-selo"
    selo.textContent = ehAssessoria(equipe) ? "Sua assessoria" : "Sua equipe"

    if (ehAssessoria(equipe)) {
      const etiqueta = document.createElement("span")
      etiqueta.className = "equipe-etiqueta"
      etiqueta.textContent = "Assessoria"
      tile.appendChild(etiqueta)
    }

    const nome = document.createElement("span")
    nome.className = "equipe-nome"
    nome.textContent = equipe.nome

    tile.appendChild(selo)
    tile.appendChild(nome)
    tile.addEventListener("click", function () {
      abrirEquipe(tile)
    })
    gradeEquipes.appendChild(tile)
  })
}

function marcarEquipe(equipeEscolhida) {
  gradeEquipes.querySelectorAll(".equipe-tile").forEach(function (tile) {
    const selecionada = tile.dataset.equipe === equipeEscolhida
    tile.classList.toggle("selecionada", selecionada)
    tile.setAttribute("aria-pressed", String(selecionada))
  })

  if (equipeEscolhida) {
    avisoEquipe.textContent = "Você faz parte da " + equipeEscolhida + "."
  } else {
    avisoEquipe.textContent = ""
  }
}

async function abrirEquipe(tile) {
  if (!perfil) {
    return
  }

  const escolhida = equipePorSlug(tile.dataset.slug)

  // Assessoria não tem entrada direta: a pessoa abre a página e pede a entrada,
  // e o treinador aprova.
  if (ehAssessoria(escolhida)) {
    window.location.href = enderecoDaEquipe(escolhida)
    return
  }

  // Quem ainda não tem equipe entra na equipe que clicou.
  // Quem já tem equipe só abre a página (para trocar, usa o botão
  // "Passar para esta equipe" dentro da página da equipe).
  if (!perfil.equipe && perfil.papel === "integrante") {
    const resposta = await cliente
      .from("profiles")
      .update({ equipe: tile.dataset.equipe })
      .eq("id", perfil.id)

    if (resposta.error) {
      avisoEquipe.textContent = "Não foi possível salvar sua equipe. Tente de novo."
      return
    }
    perfil.equipe = tile.dataset.equipe
  }

  window.location.href = enderecoDaEquipe(escolhida)
}


// ---------- Sugestões ----------
formSugestao.addEventListener("submit", async function (evento) {
  evento.preventDefault()

  const texto = sugestaoTexto.value.trim()
  msgSugestao.classList.remove("ok")

  if (texto === "") {
    msgSugestao.textContent = "Escreva sua sugestão antes de enviar."
    return
  }
  if (!perfil) {
    return
  }

  const botao = formSugestao.querySelector("button[type=submit]")
  ocupado(botao, true, "Enviar sugestão")

  const resposta = await cliente.from("sugestoes").insert({ texto: texto })

  ocupado(botao, false, "Enviar sugestão")

  if (resposta.error) {
    msgSugestao.textContent = "Não foi possível enviar agora. Tente de novo."
    return
  }

  sugestaoTexto.value = ""
  msgSugestao.classList.add("ok")
  msgSugestao.textContent = "Sugestão enviada. Obrigado por ajudar a melhorar o site."
})


// ---------- Começo: decide qual tela mostrar ----------
mostrarTela()
