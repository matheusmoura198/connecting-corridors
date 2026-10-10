// =========================================================
// PÁGINA DA EQUIPE (equipe.html)
//
// Mostra os treinos da equipe, deixa os integrantes confirmarem
// presença e deixa o líder marcar, editar e apagar treinos.
// Depende do comum.js (precisa vir antes no HTML).
// =========================================================


// ---------- Qual equipe é esta página? ----------
const parametros = new URLSearchParams(window.location.search)
const equipe = equipePorSlug(parametros.get("equipe"))


// ---------- Elementos da página ----------
const pagina = document.getElementById("pagina")
const botaoSair = document.getElementById("botao-sair")

const equipeFoto = document.getElementById("equipe-foto")
const equipeTitulo = document.getElementById("equipe-titulo")
const equipeSituacao = document.getElementById("equipe-situacao")
const botaoEntrarEquipe = document.getElementById("botao-entrar-equipe")
const msgEquipe = document.getElementById("msg-equipe")

const areaLider = document.getElementById("area-lider")
const resumoTreino = document.getElementById("resumo-treino")
const formTreino = document.getElementById("form-treino")
const campoDia = document.getElementById("treino-dia")
const campoHorario = document.getElementById("treino-horario")
const campoLocal = document.getElementById("treino-local")
const campoTipo = document.getElementById("treino-tipo")
const campoObservacao = document.getElementById("treino-observacao")
const msgTreino = document.getElementById("msg-treino")
const botaoSalvarTreino = document.getElementById("botao-salvar-treino")
const botaoCancelarTreino = document.getElementById("botao-cancelar-treino")

const avisoPresenca = document.getElementById("aviso-presenca")
const listaTreinos = document.getElementById("lista-treinos")
const semTreinos = document.getElementById("sem-treinos")

const totalIntegrantes = document.getElementById("total-integrantes")
const listaIntegrantes = document.getElementById("lista-integrantes")

// Se não for null, o formulário está editando esse treino (em vez de criar um novo)
let treinoEmEdicao = null


// ---------- Funções de apoio ----------
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

function souMembro() {
  return perfil.equipe === equipe.nome
}

function souLider() {
  return perfil.papel === "admin" || (perfil.papel === "lider" && souMembro())
}


// ---------- Começo: confere o login e monta a página ----------
async function iniciar() {
  perfil = await obterPerfilLogado()

  if (!perfil) {
    window.location.href = "index.html"
    return
  }
  if (!equipe) {
    window.location.href = "index.html#equipes"
    return
  }

  pagina.hidden = false
  montarTopo()
  montarAreaDoLider()
  await mostrarTreinos()
  await mostrarIntegrantes()
}


// ---------- Capa da equipe ----------
function montarTopo() {
  document.title = equipe.nome + " | Conecting Corridors"
  equipeTitulo.textContent = equipe.nome

  // Se a foto ainda não existir, fica só o fundo azul com o nome
  equipeFoto.addEventListener("error", function () {
    equipeFoto.hidden = true
  })
  equipeFoto.src = "img/equipe-" + equipe.slug + ".jpg"

  if (souMembro() && perfil.papel === "lider") {
    equipeSituacao.textContent = "Você é líder desta equipe."
  } else if (souMembro()) {
    equipeSituacao.textContent = "Você faz parte desta equipe."
  } else if (perfil.equipe) {
    equipeSituacao.textContent = "Você faz parte da " + perfil.equipe + ". Aqui você só acompanha esta equipe."
  } else {
    equipeSituacao.textContent = "Você ainda não escolheu uma equipe."
  }

  // Só quem é "integrante" pode trocar de equipe sozinho
  botaoEntrarEquipe.hidden = souMembro() || perfil.papel !== "integrante"

  if (!souMembro() && perfil.papel === "admin") {
    equipeSituacao.textContent = "Você é admin: pode gerenciar esta equipe."
  }
}

botaoEntrarEquipe.addEventListener("click", async function () {
  ocupado(botaoEntrarEquipe, true, "Passar para esta equipe")
  msgEquipe.textContent = ""

  const resposta = await cliente
    .from("profiles")
    .update({ equipe: equipe.nome })
    .eq("id", perfil.id)

  if (resposta.error) {
    ocupado(botaoEntrarEquipe, false, "Passar para esta equipe")
    msgEquipe.textContent = "Não foi possível trocar de equipe. Tente de novo."
    return
  }

  window.location.reload()
})


// ---------- Treinos ----------
function montarAreaDoLider() {
  areaLider.hidden = !souLider()
  // Não deixa marcar treino em dia que já passou
  campoDia.min = dataDeHoje()
}

async function mostrarTreinos() {
  const resposta = await cliente
    .from("treinos")
    .select("id, dia, horario, local_saida, tipo, observacao, presencas(user_id, profiles(nome))")
    .eq("equipe", equipe.nome)
    .gte("dia", dataDeHoje())
    .order("dia", { ascending: true })
    .order("horario", { ascending: true })

  listaTreinos.innerHTML = ""

  if (resposta.error) {
    semTreinos.textContent = "Não foi possível carregar os treinos agora."
    semTreinos.hidden = false
    return
  }

  semTreinos.textContent = "Nenhum treino marcado por enquanto."
  semTreinos.hidden = resposta.data.length > 0

  // Quem não é da equipe vê os treinos, mas não confirma presença
  avisoPresenca.hidden = souMembro() || resposta.data.length === 0
  avisoPresenca.textContent = "Para confirmar presença, você precisa fazer parte desta equipe."

  resposta.data.forEach(function (treino) {
    listaTreinos.appendChild(criarCartaoDeTreino(treino))
  })
}

function criarCartaoDeTreino(treino) {
  const cartao = criarElemento("article", "treino")

  // Dia e horário
  const quando = criarElemento("div", "treino-quando")
  quando.appendChild(criarElemento("p", "treino-dia", formatarDiaDoTreino(treino.dia)))
  quando.appendChild(criarElemento("p", "treino-horario", formatarHorario(treino.horario)))
  cartao.appendChild(quando)

  // Local, tipo e observação
  const detalhes = criarElemento("div", "treino-detalhes")
  detalhes.appendChild(criarElemento("p", "treino-local", "Saída: " + treino.local_saida))
  if (treino.tipo) {
    detalhes.appendChild(criarElemento("p", "treino-tipo", treino.tipo))
  }
  if (treino.observacao) {
    detalhes.appendChild(criarElemento("p", "treino-obs", treino.observacao))
  }
  cartao.appendChild(detalhes)

  // Presença
  const presencas = treino.presencas || []
  const euVou = presencas.some(function (presenca) {
    return presenca.user_id === perfil.id
  })

  const presenca = criarElemento("div", "treino-presenca")

  if (souMembro()) {
    const botaoVou = criarElemento("button", "botao-vou", euVou ? "Confirmado" : "Eu vou")
    botaoVou.type = "button"
    botaoVou.setAttribute("aria-pressed", String(euVou))
    botaoVou.addEventListener("click", async function () {
      botaoVou.disabled = true
      await alternarPresenca(treino.id, euVou)
    })
    presenca.appendChild(botaoVou)
  }

  const contagem = presencas.length === 1 ? "1 pessoa vai" : presencas.length + " pessoas vão"
  presenca.appendChild(criarElemento("p", "treino-contagem", contagem))

  if (presencas.length > 0) {
    const nomes = presencas.map(function (item) {
      return item.profiles ? item.profiles.nome : "Usuário"
    })
    presenca.appendChild(criarElemento("p", "treino-nomes", nomes.join(", ")))
  }
  cartao.appendChild(presenca)

  // Botões do líder
  if (souLider()) {
    const acoes = criarElemento("div", "treino-acoes")

    const editar = criarElemento("button", "botao-texto", "Editar")
    editar.type = "button"
    editar.addEventListener("click", function () {
      comecarEdicao(treino)
    })

    const apagar = criarElemento("button", "botao-texto botao-texto-perigo", "Apagar")
    apagar.type = "button"
    apagar.addEventListener("click", async function () {
      if (!window.confirm("Apagar este treino? As confirmações de presença também serão apagadas.")) {
        return
      }
      const resposta = await cliente.from("treinos").delete().eq("id", treino.id)
      if (resposta.error) {
        window.alert("Não foi possível apagar o treino. Tente de novo.")
        return
      }
      await mostrarTreinos()
    })

    acoes.appendChild(editar)
    acoes.appendChild(apagar)
    cartao.appendChild(acoes)
  }

  return cartao
}

// Confirma ou desfaz a presença da pessoa num treino
async function alternarPresenca(idTreino, jaConfirmado) {
  let resposta

  if (jaConfirmado) {
    resposta = await cliente
      .from("presencas")
      .delete()
      .eq("treino_id", idTreino)
      .eq("user_id", perfil.id)
  } else {
    resposta = await cliente.from("presencas").insert({ treino_id: idTreino })
  }

  if (resposta.error) {
    window.alert("Não foi possível salvar sua presença. Tente de novo.")
  }
  await mostrarTreinos()
}


// ---------- Formulário do líder ----------
function comecarEdicao(treino) {
  treinoEmEdicao = treino.id
  campoDia.value = treino.dia
  campoHorario.value = formatarHorario(treino.horario)
  campoLocal.value = treino.local_saida
  campoTipo.value = treino.tipo
  campoObservacao.value = treino.observacao

  resumoTreino.textContent = "Editando treino"
  botaoSalvarTreino.textContent = "Salvar alterações"
  botaoCancelarTreino.hidden = false
  msgTreino.textContent = ""

  areaLider.open = true
  areaLider.scrollIntoView({ behavior: "smooth", block: "start" })
}

function terminarEdicao() {
  treinoEmEdicao = null
  formTreino.reset()
  resumoTreino.textContent = "Marcar novo treino"
  botaoSalvarTreino.textContent = "Marcar treino"
  botaoCancelarTreino.hidden = true
}

botaoCancelarTreino.addEventListener("click", function () {
  terminarEdicao()
  msgTreino.textContent = ""
})

formTreino.addEventListener("submit", async function (evento) {
  evento.preventDefault()

  const dados = {
    dia: campoDia.value,
    horario: campoHorario.value,
    local_saida: campoLocal.value.trim(),
    tipo: campoTipo.value.trim(),
    observacao: campoObservacao.value.trim()
  }

  if (dados.dia === "" || dados.horario === "") {
    msgTreino.textContent = "Escolha o dia e o horário do treino."
    return
  }
  if (dados.dia < dataDeHoje()) {
    msgTreino.textContent = "Escolha um dia de hoje em diante."
    return
  }
  if (dados.local_saida.length < 2) {
    msgTreino.textContent = "Informe o local de saída."
    return
  }

  msgTreino.textContent = ""
  const textoDoBotao = treinoEmEdicao ? "Salvar alterações" : "Marcar treino"
  ocupado(botaoSalvarTreino, true, textoDoBotao)

  let resposta
  if (treinoEmEdicao) {
    resposta = await cliente.from("treinos").update(dados).eq("id", treinoEmEdicao)
  } else {
    dados.equipe = equipe.nome
    resposta = await cliente.from("treinos").insert(dados)
  }

  ocupado(botaoSalvarTreino, false, textoDoBotao)

  if (resposta.error) {
    msgTreino.textContent = "Não foi possível salvar o treino. Tente de novo."
    return
  }

  terminarEdicao()
  areaLider.open = false
  await mostrarTreinos()
})


// ---------- Integrantes ----------
async function mostrarIntegrantes() {
  const resposta = await cliente
    .from("profiles")
    .select("id, nome, papel")
    .eq("equipe", equipe.nome)
    .order("nome", { ascending: true })

  listaIntegrantes.innerHTML = ""

  if (resposta.error) {
    totalIntegrantes.textContent = "Não foi possível carregar os integrantes agora."
    return
  }

  const integrantes = resposta.data

  // Líderes primeiro, depois os outros em ordem alfabética
  integrantes.sort(function (a, b) {
    const pesoA = a.papel === "lider" ? 0 : 1
    const pesoB = b.papel === "lider" ? 0 : 1
    return pesoA - pesoB
  })

  if (integrantes.length === 0) {
    totalIntegrantes.textContent = "Ainda não há integrantes nesta equipe."
    return
  }

  totalIntegrantes.textContent =
    integrantes.length === 1 ? "1 integrante" : integrantes.length + " integrantes"

  integrantes.forEach(function (integrante) {
    const item = criarElemento("li", "integrante")
    item.appendChild(criarElemento("span", "integrante-nome", integrante.nome))

    if (integrante.id === perfil.id) {
      item.appendChild(criarElemento("span", "integrante-etiqueta", "você"))
    }
    if (integrante.papel === "lider") {
      item.appendChild(criarElemento("span", "integrante-etiqueta integrante-lider", "Líder"))
    }
    listaIntegrantes.appendChild(item)
  })
}


// ---------- Sair ----------
botaoSair.addEventListener("click", async function () {
  await cliente.auth.signOut()
  window.location.href = "index.html"
})


iniciar()
