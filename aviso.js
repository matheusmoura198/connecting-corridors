// ---------- Elementos da página ----------
const avisoFixado = document.getElementById("aviso-fixado")
const avisoFixadoTexto = document.getElementById("aviso-fixado-texto")
const avisoFixadoData = document.getElementById("aviso-fixado-data")
const avisoFixadoWhatsapp = document.getElementById("aviso-fixado-whatsapp")
const areaAviso = document.getElementById("area-aviso")
const formAviso = document.getElementById("form-aviso")
const campoAviso = document.getElementById("aviso-campo")
const msgAviso = document.getElementById("msg-aviso")
const botaoPublicarAviso = document.getElementById("botao-publicar-aviso")
const botaoRemoverAviso = document.getElementById("botao-remover-aviso")


// ---------- Aviso fixado do líder ----------

function montarMensagemDoAviso() {
  const endereco = new URL(enderecoDaEquipe(equipe), window.location.href).href

  return [
    "📢 Aviso da " + equipe.nome,
    "",
    equipe.aviso,
    "",
    "Veja no site:",
    endereco
  ].join("\n")
}

// Mostra (ou esconde) o aviso no topo e prepara o formulário do líder
function mostrarAviso() {
  const texto = equipe.aviso || ""

  avisoFixado.hidden = texto === ""
  botaoRemoverAviso.hidden = texto === ""
  campoAviso.value = texto
  avisoFixadoWhatsapp.innerHTML = ""

  if (texto === "") {
    return
  }

  avisoFixadoTexto.textContent = texto
  avisoFixadoData.textContent = equipe.aviso_em ? "Atualizado em " + formatarData(equipe.aviso_em) : ""

  const link = criarElemento("a", "botao-whatsapp", "Compartilhar no WhatsApp")
  link.href = "https://wa.me/?text=" + encodeURIComponent(montarMensagemDoAviso())
  link.target = "_blank"
  link.rel = "noopener"
  avisoFixadoWhatsapp.appendChild(link)
}

async function salvarAviso(texto) {
  msgAviso.textContent = ""
  ocupado(botaoPublicarAviso, true, "Publicar aviso")

  // O ".select()" devolve as linhas alteradas: se vier vazio, o banco não permitiu
  const resposta = await cliente
    .from("equipes")
    .update({ aviso: texto })
    .eq("nome", equipe.nome)
    .select()

  ocupado(botaoPublicarAviso, false, "Publicar aviso")

  if (resposta.error || !resposta.data || resposta.data.length === 0) {
    console.error("Erro ao salvar o aviso:", resposta.error)
    msgAviso.textContent = "Não foi possível salvar o aviso. Tente de novo."
    return
  }

  await carregarEquipes()
  equipe = equipePorSlug(equipe.slug)
  mostrarAviso()
  areaAviso.open = false
}

formAviso.addEventListener("submit", async function (evento) {
  evento.preventDefault()

  const texto = campoAviso.value.trim()
  if (texto === "") {
    msgAviso.textContent = "Escreva o aviso, ou use o botão Remover aviso."
    return
  }
  await salvarAviso(texto)
})

botaoRemoverAviso.addEventListener("click", async function () {
  if (!window.confirm("Remover o aviso da equipe?")) {
    return
  }
  await salvarAviso("")
})
