// ---------- Conexão com o Supabase ----------
const configurado =
  typeof SUPABASE_URL === "string" &&
  typeof SUPABASE_ANON_KEY === "string" &&
  !SUPABASE_URL.includes("COLE_AQUI") &&
  !SUPABASE_ANON_KEY.includes("COLE_AQUI")

let cliente = null
if (configurado && window.supabase) {
  cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// Dados do usuário logado: { id, nome, equipe, papel }
let perfil = null


// ---------- As equipes ----------
let EQUIPES = []

async function carregarEquipes() {
  const resposta = await cliente
    .from("equipes")
    .select("slug, nome, foto")
    .order("criado_em", { ascending: true })

  EQUIPES = resposta.error ? [] : resposta.data
}

function equipePorSlug(slug) {
  return EQUIPES.find(function (equipe) {
    return equipe.slug === slug
  })
}


// ---------- Funções de apoio ----------
// Isso vai traduzir os erros do Supabase para mensagens fáceis de entender
function mensagemDeErro(erro) {
  const texto = erro && erro.message ? erro.message : ""

  if (texto.includes("Invalid login credentials")) {
    return "Email ou senha incorretos."
  }
  if (texto.includes("Email not confirmed")) {
    return "Confirme seu email antes de entrar. Procure a mensagem na sua caixa de entrada."
  }
  if (texto.includes("already registered")) {
    return "Já existe uma conta com esse email. Use a aba Entrar."
  }
  if (texto.includes("Database error saving new user")) {
    return "Esse nome de usuário já está em uso. Escolha outro."
  }
  if (texto.includes("Password should be")) {
    return "A senha precisa ter pelo menos 6 caracteres."
  }
  if (texto.includes("rate limit")) {
    return "Muitas tentativas. Espere alguns minutos e tente de novo."
  }
  return "Algo deu errado. Confira sua internet e tente de novo."
}

// Deixa o botão "ocupado" enquanto espera o Supabase responder
function ocupado(botao, estaOcupado, textoNormal) {
  botao.disabled = estaOcupado
  botao.textContent = estaOcupado ? "Aguarde..." : textoNormal
}

function formatarData(valor) {
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })
}

async function carregarPerfil(idUsuario) {
  const resposta = await cliente
    .from("profiles")
    .select("id, nome, equipe, papel")
    .eq("id", idUsuario)
    .single()

  if (resposta.error) {
    return null
  }
  return resposta.data
}

// Devolve o perfil de quem está logado, ou null se ninguém estiver
async function obterPerfilLogado() {
  if (!cliente) {
    return null
  }

  const resposta = await cliente.auth.getSession()
  const sessao = resposta.data.session
  if (!sessao) {
    return null
  }
  return await carregarPerfil(sessao.user.id)
}

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag)
  if (classe) {
    elemento.className = classe
  }
  if (texto !== undefined) {
    elemento.textContent = texto
  }
  return elemento
}
