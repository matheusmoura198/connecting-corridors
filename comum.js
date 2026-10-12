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
// As equipes ficam na tabela "equipes" do Supabase (slug, nome e foto).
// Para criar uma equipe nova, basta adicionar uma linha lá.
// O "slug" é o nome curto que vai no endereço da página
// (equipe.html?equipe=vai-na-fe).
let EQUIPES = []

async function carregarEquipes() {
  let resposta = await cliente
    .from("equipes")
    .select("slug, nome, foto, aviso, aviso_em")
    .order("criado_em", { ascending: true })

  // Se as colunas do aviso ainda não existem no banco (o SQL do aviso ainda não
  // foi rodado), carrega as equipes sem elas para o site continuar funcionando.
  if (resposta.error) {
    resposta = await cliente
      .from("equipes")
      .select("slug, nome, foto")
      .order("criado_em", { ascending: true })
  }

  EQUIPES = resposta.error ? [] : resposta.data
}

function equipePorSlug(slug) {
  return EQUIPES.find(function (equipe) {
    return equipe.slug === slug
  })
}


// ---------- Funções de apoio ----------

// Traduz os erros do Supabase para mensagens fáceis de entender
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

// Cria um elemento HTML já com classe e texto (o texto entra como texto, nunca como HTML)
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

// Lembra a página que a pessoa queria abrir antes de fazer login
// (por exemplo, o link de um treino que veio pelo WhatsApp).
function guardarDestino(endereco) {
  try {
    sessionStorage.setItem("voltar_para", endereco)
  } catch (erro) {
    // Se o navegador não deixar guardar, a pessoa só cai na página inicial
  }
}

// Devolve o endereço guardado (e esquece dele). Só aceita endereços deste mesmo site.
function pegarDestino() {
  try {
    const endereco = sessionStorage.getItem("voltar_para")
    sessionStorage.removeItem("voltar_para")
    if (endereco && new URL(endereco).origin === window.location.origin) {
      return endereco
    }
  } catch (erro) {
    return null
  }
  return null
}

// ---------- Datas e horários dos treinos ----------

// Data de hoje no formato do banco: 2026-10-11
function dataDeHoje() {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, "0")
  const dia = String(agora.getDate()).padStart(2, "0")
  return agora.getFullYear() + "-" + mes + "-" + dia
}

// Transforma 2026-10-11 em "Domingo, 11/10"
function formatarDiaDoTreino(diaTexto) {
  const partes = diaTexto.split("-")
  const data = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
  const texto = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit"
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// O banco devolve 05:30:00. Mostramos só 05:30
function formatarHorario(horarioTexto) {
  return horarioTexto.slice(0, 5)
}
