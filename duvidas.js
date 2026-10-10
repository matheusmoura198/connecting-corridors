const DUVIDAS_POR_VEZ = 15

// null = dúvidas gerais. Um nome = dúvidas dessa equipe.
let equipeDasDuvidas = null
let limiteDeDuvidas = DUVIDAS_POR_VEZ

// false = mostra as em aberto. true = mostra as resolvidas.
let verResolvidas = false


// ---------- Elementos da página ----------
const formDuvida = document.getElementById("form-duvida")
const avisoDuvidas = document.getElementById("aviso-duvidas")
const campoTituloDuvida = document.getElementById("duvida-titulo")
const campoDetalheDuvida = document.getElementById("duvida-detalhe")
const msgDuvida = document.getElementById("msg-duvida")
const botaoPerguntar = document.getElementById("botao-perguntar")
const filtroAbertas = document.getElementById("filtro-abertas")
const filtroResolvidas = document.getElementById("filtro-resolvidas")
const listaDuvidas = document.getElementById("lista-duvidas")
const semDuvidas = document.getElementById("sem-duvidas")
const botaoMaisDuvidas = document.getElementById("botao-mais-duvidas")


// ---------- Quem pode o quê ----------

// Nas dúvidas gerais todo mundo participa. Nas da equipe, só quem é da equipe (ou o admin).
function podeParticiparDasDuvidas() {
  return (
    equipeDasDuvidas === null ||
    perfil.equipe === equipeDasDuvidas ||
    perfil.papel === "admin"
  )
}

// Quem escreveu, o líder da equipe (nas dúvidas dela) e o admin gerenciam
function podeGerenciar(item) {
  if (perfil.id === item.user_id || perfil.papel === "admin") {
    return true
  }
  return perfil.papel === "lider" && item.equipe !== null && perfil.equipe === item.equipe
}


// ---------- Começo ----------
// Chame com null (dúvidas gerais) ou com o nome da equipe
function iniciarDuvidas(nomeDaEquipe) {
  equipeDasDuvidas = nomeDaEquipe
  limiteDeDuvidas = DUVIDAS_POR_VEZ
  verResolvidas = false

  const podeParticipar = podeParticiparDasDuvidas()
  formDuvida.hidden = !podeParticipar
  avisoDuvidas.hidden = podeParticipar

  marcarFiltro()
  mostrarDuvidas()
}

function marcarFiltro() {
  filtroAbertas.setAttribute("aria-selected", String(!verResolvidas))
  filtroResolvidas.setAttribute("aria-selected", String(verResolvidas))
}

filtroAbertas.addEventListener("click", function () {
  verResolvidas = false
  limiteDeDuvidas = DUVIDAS_POR_VEZ
  marcarFiltro()
  mostrarDuvidas()
})

filtroResolvidas.addEventListener("click", function () {
  verResolvidas = true
  limiteDeDuvidas = DUVIDAS_POR_VEZ
  marcarFiltro()
  mostrarDuvidas()
})

botaoMaisDuvidas.addEventListener("click", async function () {
  limiteDeDuvidas += DUVIDAS_POR_VEZ
  await mostrarDuvidas()
})


// ---------- Perguntar ----------
formDuvida.addEventListener("submit", async function (evento) {
  evento.preventDefault()

  const titulo = campoTituloDuvida.value.trim()
  const detalhe = campoDetalheDuvida.value.trim()

  if (titulo.length < 5) {
    msgDuvida.textContent = "Escreva a sua dúvida com pelo menos 5 letras."
    return
  }

  msgDuvida.textContent = ""
  ocupado(botaoPerguntar, true, "Perguntar")

  const resposta = await cliente
    .from("duvidas")
    .insert({ equipe: equipeDasDuvidas, titulo: titulo, detalhe: detalhe })

  ocupado(botaoPerguntar, false, "Perguntar")

  if (resposta.error) {
    msgDuvida.textContent = "Não foi possível enviar a dúvida. Tente de novo."
    return
  }

  formDuvida.reset()

  // A pergunta nova está "em aberto": volta para esse filtro para ela aparecer
  verResolvidas = false
  marcarFiltro()
  await mostrarDuvidas(true)
})


// ---------- Lista de dúvidas ----------
async function mostrarDuvidas(destacarPrimeira) {
  let consulta = cliente
    .from("duvidas")
    .select(
      "id, user_id, equipe, titulo, detalhe, resolvida, criado_em, profiles(nome), respostas(id, user_id, texto, criado_em, profiles(nome))"
    )
    .eq("resolvida", verResolvidas)

  if (equipeDasDuvidas === null) {
    consulta = consulta.is("equipe", null)
  } else {
    consulta = consulta.eq("equipe", equipeDasDuvidas)
  }

  const resposta = await consulta
    .order("criado_em", { ascending: false })
    .limit(limiteDeDuvidas)

  listaDuvidas.innerHTML = ""

  if (resposta.error) {
    semDuvidas.textContent = "Não foi possível carregar as dúvidas agora."
    semDuvidas.hidden = false
    botaoMaisDuvidas.hidden = true
    return
  }

  semDuvidas.textContent = verResolvidas
    ? "Nenhuma dúvida resolvida ainda."
    : "Nenhuma dúvida em aberto. Faça a primeira pergunta."
  semDuvidas.hidden = resposta.data.length > 0

  // Se veio o máximo pedido, provavelmente há dúvidas mais antigas
  botaoMaisDuvidas.hidden = resposta.data.length < limiteDeDuvidas

  resposta.data.forEach(function (duvida, posicao) {
    const cartao = criarCartaoDeDuvida(duvida)
    if (destacarPrimeira && posicao === 0) {
      cartao.classList.add("novo")
    }
    listaDuvidas.appendChild(cartao)
  })
}

function criarCartaoDeDuvida(duvida) {
  const cartao = criarElemento("article", duvida.resolvida ? "duvida duvida-resolvida" : "duvida")

  // Topo: quem perguntou, quando, e se já foi resolvida
  const topo = criarElemento("div", "duvida-topo")
  topo.appendChild(criarElemento("span", "duvida-autor", duvida.profiles ? duvida.profiles.nome : "Usuário"))
  topo.appendChild(criarElemento("span", "duvida-data", formatarData(duvida.criado_em)))
  if (duvida.resolvida) {
    topo.appendChild(criarElemento("span", "duvida-etiqueta", "Resolvida"))
  }
  cartao.appendChild(topo)

  cartao.appendChild(criarElemento("h3", "duvida-titulo", duvida.titulo))
  if (duvida.detalhe) {
    cartao.appendChild(criarElemento("p", "duvida-detalhe", duvida.detalhe))
  }

  // Respostas, da mais antiga para a mais nova
  const respostas = (duvida.respostas || []).slice().sort(function (a, b) {
    return new Date(a.criado_em) - new Date(b.criado_em)
  })

  if (respostas.length > 0) {
    const listaRespostas = criarElemento("div", "respostas")
    respostas.forEach(function (resposta) {
      listaRespostas.appendChild(criarResposta(resposta, duvida))
    })
    cartao.appendChild(listaRespostas)
  }

  // Ações
  const acoes = criarElemento("div", "duvida-acoes")
  const total = respostas.length === 1 ? "1 resposta" : respostas.length + " respostas"
  acoes.appendChild(criarElemento("span", "duvida-total", total))

  const formResposta = criarFormularioDeResposta(duvida)

  if (podeParticiparDasDuvidas()) {
    const responder = criarElemento("button", "botao-texto", "Responder")
    responder.type = "button"
    responder.setAttribute("aria-expanded", "false")
    responder.addEventListener("click", function () {
      const abrir = formResposta.hidden
      formResposta.hidden = !abrir
      responder.setAttribute("aria-expanded", String(abrir))
      if (abrir) {
        formResposta.querySelector("textarea").focus()
      }
    })
    acoes.appendChild(responder)
  }

  if (podeGerenciar(duvida)) {
    const resolver = criarElemento(
      "button",
      "botao-texto",
      duvida.resolvida ? "Reabrir" : "Marcar como resolvida"
    )
    resolver.type = "button"
    resolver.addEventListener("click", async function () {
      resolver.disabled = true
      const resultado = await cliente
        .from("duvidas")
        .update({ resolvida: !duvida.resolvida })
        .eq("id", duvida.id)

      if (resultado.error) {
        resolver.disabled = false
        window.alert("Não foi possível atualizar a dúvida. Tente de novo.")
        return
      }
      await mostrarDuvidas(false)
    })
    acoes.appendChild(resolver)

    const apagar = criarElemento("button", "botao-texto botao-texto-perigo", "Apagar")
    apagar.type = "button"
    apagar.addEventListener("click", async function () {
      if (!window.confirm("Apagar esta dúvida e todas as respostas dela?")) {
        return
      }
      const resultado = await cliente.from("duvidas").delete().eq("id", duvida.id)
      if (resultado.error) {
        window.alert("Não foi possível apagar a dúvida. Tente de novo.")
        return
      }
      await mostrarDuvidas(false)
    })
    acoes.appendChild(apagar)
  }

  cartao.appendChild(acoes)
  cartao.appendChild(formResposta)
  return cartao
}

function criarResposta(resposta, duvida) {
  const caixa = criarElemento("div", "resposta")

  const topo = criarElemento("div", "resposta-topo")
  topo.appendChild(criarElemento("span", "duvida-autor", resposta.profiles ? resposta.profiles.nome : "Usuário"))
  topo.appendChild(criarElemento("span", "duvida-data", formatarData(resposta.criado_em)))

  // Apaga a resposta: quem escreveu ou quem gerencia a dúvida
  if (perfil.id === resposta.user_id || podeGerenciar(duvida)) {
    const apagar = criarElemento("button", "botao-texto botao-texto-perigo resposta-apagar", "Apagar")
    apagar.type = "button"
    apagar.addEventListener("click", async function () {
      if (!window.confirm("Apagar esta resposta?")) {
        return
      }
      const resultado = await cliente.from("respostas").delete().eq("id", resposta.id)
      if (resultado.error) {
        window.alert("Não foi possível apagar a resposta. Tente de novo.")
        return
      }
      await mostrarDuvidas(false)
    })
    topo.appendChild(apagar)
  }

  caixa.appendChild(topo)
  caixa.appendChild(criarElemento("p", "resposta-texto", resposta.texto))
  return caixa
}

// Formulário de resposta (começa escondido; o botão "Responder" abre)
function criarFormularioDeResposta(duvida) {
  const formulario = criarElemento("form", "formulario form-resposta")
  formulario.hidden = true
  formulario.noValidate = true

  const campo = criarElemento("div", "campo")
  const rotulo = criarElemento("label", "", "Sua resposta")
  const area = criarElemento("textarea")
  area.rows = 3
  area.maxLength = 500
  area.id = "resposta-texto-" + duvida.id
  rotulo.htmlFor = area.id
  campo.appendChild(rotulo)
  campo.appendChild(area)

  const mensagem = criarElemento("p", "mensagem")
  mensagem.setAttribute("role", "alert")

  const enviar = criarElemento("button", "botao", "Enviar resposta")
  enviar.type = "submit"

  formulario.appendChild(campo)
  formulario.appendChild(mensagem)
  formulario.appendChild(enviar)

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault()

    const texto = area.value.trim()
    if (texto === "") {
      mensagem.textContent = "Escreva a sua resposta."
      return
    }

    mensagem.textContent = ""
    ocupado(enviar, true, "Enviar resposta")

    const resultado = await cliente
      .from("respostas")
      .insert({ duvida_id: duvida.id, texto: texto })

    ocupado(enviar, false, "Enviar resposta")

    if (resultado.error) {
      mensagem.textContent = "Não foi possível enviar a resposta. Tente de novo."
      return
    }
    await mostrarDuvidas(false)
  })

  return formulario
}
