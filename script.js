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

  telaLogin.hidden = true
  telaSite.hidden = false
  nomeUsuario.textContent = perfil.nome
  await carregarEquipes()
  desenharEquipes()
  marcarEquipe(perfil.equipe)
  iniciarMural(null)
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
    selo.textContent = "Sua equipe"

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

  window.location.href = "equipe.html?equipe=" + tile.dataset.slug
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
