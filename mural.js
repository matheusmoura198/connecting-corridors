const PASTA_FOTOS = "fotos"
const POSTS_POR_VEZ = 20
const TAMANHO_MAXIMO_DA_FOTO = 1500000

// Coração (texto fixo, sem dados de usuário). O CSS pinta o contorno ou o preenchimento.
const ICONE_CORACAO =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
  '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' +
  "</svg>"

// null = Comunidade geral. Um nome = mural dessa equipe.
let equipeDoMural = null
let limiteDePosts = POSTS_POR_VEZ

// Opções do mural (usadas pela página da assessoria):
// tipo = "treino" ou "publicacao" (null = sem separação)
// somenteTreinador = só o treinador (ou o admin) publica
let opcoesDoMural = { tipo: null, somenteTreinador: false }

// Foto já reduzida (Blob), pronta para enviar
let fotoEscolhida = null
let enderecoDaPrevia = null


// ---------- Elementos da página ----------
const formPost = document.getElementById("form-post")
const avisoMural = document.getElementById("aviso-mural")
const postTexto = document.getElementById("post-texto")
const postFoto = document.getElementById("post-foto")
const previaFoto = document.getElementById("previa-foto")
const previaImagem = document.getElementById("previa-imagem")
const botaoRemoverFoto = document.getElementById("botao-remover-foto")
const msgPost = document.getElementById("msg-post")
const botaoPublicar = document.getElementById("botao-publicar")
const listaPosts = document.getElementById("lista-posts")
const semPosts = document.getElementById("sem-posts")
const botaoMaisPosts = document.getElementById("botao-mais-posts")

// Campos extras do treino. Só existem na página da assessoria (nas outras ficam null).
const campoTituloPost = document.getElementById("post-titulo-campo")
const postTitulo = document.getElementById("post-titulo")
const campoLinkPost = document.getElementById("post-link-campo")
const postLink = document.getElementById("post-link")


// ---------- Começo ----------
// Chame com null (Comunidade) ou com o nome da equipe (mural da equipe).
// Na assessoria, passe também as opções: iniciarMural(nome, { tipo: "treino", somenteTreinador: true })
function iniciarMural(nomeDaEquipe, opcoes) {
  equipeDoMural = nomeDaEquipe
  opcoesDoMural = Object.assign({ tipo: null, somenteTreinador: false }, opcoes || {})
  limiteDePosts = POSTS_POR_VEZ

  let podePublicar
  if (opcoesDoMural.somenteTreinador) {
    // Assessoria: só o treinador (líder da assessoria) ou o admin
    podePublicar = ehTreinadorDe(nomeDaEquipe)
  } else {
    // Na Comunidade todo mundo publica. No mural, só quem é da equipe (ou o admin).
    podePublicar =
      nomeDaEquipe === null || perfil.equipe === nomeDaEquipe || perfil.papel === "admin"
  }

  formPost.hidden = !podePublicar
  avisoMural.hidden = podePublicar

  // Título e link da planilha: só no formulário de treino
  const ehTreino = opcoesDoMural.tipo === "treino"
  if (campoTituloPost) {
    campoTituloPost.hidden = !ehTreino
  }
  if (campoLinkPost) {
    campoLinkPost.hidden = !ehTreino
  }
  msgPost.textContent = ""

  mostrarPosts(false)
}

// O treinador de uma equipe/assessoria é quem tem o papel "lider" nela. O admin vale em qualquer uma.
function ehTreinadorDe(nomeDaEquipe) {
  if (perfil.papel === "admin") {
    return true
  }
  return perfil.papel === "lider" && nomeDaEquipe !== null && perfil.equipe === nomeDaEquipe
}

// Só aceita links http/https (evita "javascript:" e parecidos)
function linkValido(texto) {
  try {
    const endereco = new URL(texto)
    return endereco.protocol === "https:" || endereco.protocol === "http:"
  } catch (erro) {
    return false
  }
}


// ---------- Fotos ----------
function carregarImagem(arquivo) {
  return new Promise(function (resolve, reject) {
    const endereco = URL.createObjectURL(arquivo)
    const imagem = new Image()

    imagem.addEventListener("load", function () {
      URL.revokeObjectURL(endereco)
      resolve(imagem)
    })
    imagem.addEventListener("error", function () {
      URL.revokeObjectURL(endereco)
      reject(new Error("imagem inválida"))
    })
    imagem.src = endereco
  })
}

// Reduz a foto no próprio navegador antes de enviar (celular tira fotos
// de vários MB, e o espaço grátis do Supabase é limitado).
// Devolve um Blob JPEG, ou null se não conseguir.
async function comprimirFoto(arquivo) {
  let imagem
  try {
    imagem = await carregarImagem(arquivo)
  } catch (erro) {
    return null
  }

  const tentativas = [
    { lado: 1280, qualidade: 0.82 },
    { lado: 1024, qualidade: 0.7 },
    { lado: 800, qualidade: 0.6 }
  ]

  for (const tentativa of tentativas) {
    const escala = Math.min(1, tentativa.lado / Math.max(imagem.width, imagem.height))
    const tela = document.createElement("canvas")
    tela.width = Math.round(imagem.width * escala)
    tela.height = Math.round(imagem.height * escala)
    tela.getContext("2d").drawImage(imagem, 0, 0, tela.width, tela.height)

    const resultado = await new Promise(function (resolve) {
      tela.toBlob(resolve, "image/jpeg", tentativa.qualidade)
    })

    if (resultado && resultado.size <= TAMANHO_MAXIMO_DA_FOTO) {
      return resultado
    }
  }
  return null
}

function nomeUnico() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID()
  }
  return Date.now() + "-" + Math.random().toString(36).slice(2)
}

function enderecoDaFoto(caminho) {
  return cliente.storage.from(PASTA_FOTOS).getPublicUrl(caminho).data.publicUrl
}

function limparFotoEscolhida() {
  fotoEscolhida = null
  postFoto.value = ""
  previaFoto.hidden = true
  if (enderecoDaPrevia) {
    URL.revokeObjectURL(enderecoDaPrevia)
    enderecoDaPrevia = null
  }
  previaImagem.removeAttribute("src")
}

postFoto.addEventListener("change", async function () {
  const arquivo = postFoto.files[0]
  msgPost.textContent = ""
  if (!arquivo) {
    return
  }

  const reduzida = await comprimirFoto(arquivo)
  if (!reduzida) {
    limparFotoEscolhida()
    msgPost.textContent = "Não foi possível usar essa foto. Tente outra (de preferência JPG ou PNG)."
    return
  }

  fotoEscolhida = reduzida
  if (enderecoDaPrevia) {
    URL.revokeObjectURL(enderecoDaPrevia)
  }
  enderecoDaPrevia = URL.createObjectURL(reduzida)
  previaImagem.src = enderecoDaPrevia
  previaFoto.hidden = false
})

botaoRemoverFoto.addEventListener("click", function () {
  limparFotoEscolhida()
})


// ---------- Publicar ----------
formPost.addEventListener("submit", async function (evento) {
  evento.preventDefault()

  const texto = postTexto.value.trim()
  const ehTreino = opcoesDoMural.tipo === "treino"
  const titulo = ehTreino && postTitulo ? postTitulo.value.trim() : ""
  const link = ehTreino && postLink ? postLink.value.trim() : ""

  if (ehTreino && titulo.length < 3) {
    msgPost.textContent = "Dê um título ao treino (pelo menos 3 letras)."
    return
  }
  if (link !== "" && !linkValido(link)) {
    msgPost.textContent = "O link da planilha precisa começar com https://"
    return
  }
  if (texto === "" && !fotoEscolhida && link === "") {
    msgPost.textContent = "Escreva uma mensagem, escolha uma foto ou cole o link da planilha."
    return
  }

  msgPost.textContent = ""
  ocupado(botaoPublicar, true, "Publicar")

  // 1. Envia a foto (se houver). Fica na pasta com o id de quem enviou.
  let caminho = null
  if (fotoEscolhida) {
    caminho = perfil.id + "/" + nomeUnico() + ".jpg"
    const envio = await cliente.storage
      .from(PASTA_FOTOS)
      .upload(caminho, fotoEscolhida, { contentType: "image/jpeg" })

    if (envio.error) {
      ocupado(botaoPublicar, false, "Publicar")
      msgPost.textContent = "Não foi possível enviar a foto. Tente de novo."
      return
    }
  }

  // 2. Cria a postagem
  const novoPost = { equipe: equipeDoMural, texto: texto, foto_caminho: caminho }
  if (opcoesDoMural.tipo) {
    novoPost.tipo = opcoesDoMural.tipo
  }
  if (ehTreino) {
    novoPost.titulo = titulo
    novoPost.link = link === "" ? null : link
  }

  const resposta = await cliente.from("posts").insert(novoPost)

  ocupado(botaoPublicar, false, "Publicar")

  if (resposta.error) {
    // Não deixa uma foto solta no armazenamento se a postagem falhou
    if (caminho) {
      await cliente.storage.from(PASTA_FOTOS).remove([caminho])
    }
    msgPost.textContent = "Não foi possível publicar. Tente de novo."
    return
  }

  postTexto.value = ""
  if (postTitulo) {
    postTitulo.value = ""
  }
  if (postLink) {
    postLink.value = ""
  }
  limparFotoEscolhida()
  await mostrarPosts(true)
})


// ---------- Lista de postagens ----------

// Monta a consulta das postagens. "completo" inclui as colunas novas (tipo, título,
// link da planilha e fixado). Se o SQL de atualização ainda não foi rodado, o
// mural cai para a consulta antiga e continua funcionando.
function montarConsultaDePosts(completo) {
  // Atenção: "profiles!posts_user_id_fkey(nome)" diz ao Supabase qual ligação usar
  // para buscar o nome de quem postou. Sem isso, ele encontra dois caminhos entre
  // postagens e perfis (direto e pelas curtidas) e se recusa a carregar as postagens.
  const colunas =
    "id, user_id, equipe, texto, foto_caminho, criado_em, " +
    (completo ? "tipo, titulo, link, fixado, " : "") +
    "profiles!posts_user_id_fkey(nome), curtidas(user_id), " +
    "post_comentarios(id, user_id, texto, criado_em, profiles(nome))"

  let consulta = cliente.from("posts").select(colunas)

  if (equipeDoMural === null) {
    consulta = consulta.is("equipe", null)
  } else {
    consulta = consulta.eq("equipe", equipeDoMural)
  }

  if (completo && opcoesDoMural.tipo) {
    consulta = consulta.eq("tipo", opcoesDoMural.tipo)
  }

  // Fixados primeiro, depois do mais novo para o mais antigo
  if (completo) {
    consulta = consulta.order("fixado", { ascending: false })
  }
  return consulta.order("criado_em", { ascending: false }).limit(limiteDePosts)
}

async function mostrarPosts(destacarPrimeiro) {
  let resposta = await montarConsultaDePosts(true)

  // Coluna que ainda não existe no banco (42703): usa a consulta antiga,
  // a não ser na assessoria, que depende das colunas novas.
  if (resposta.error && resposta.error.code === "42703" && !opcoesDoMural.tipo) {
    resposta = await montarConsultaDePosts(false)
  }

  listaPosts.innerHTML = ""

  if (resposta.error) {
    console.error("Erro ao carregar as postagens:", resposta.error)
    semPosts.textContent = "Não foi possível carregar as postagens agora."
    semPosts.hidden = false
    botaoMaisPosts.hidden = true
    return
  }

  if (opcoesDoMural.tipo === "treino") {
    semPosts.textContent = ehTreinadorDe(equipeDoMural)
      ? "Nenhum treino publicado ainda. Use o formulário acima para publicar o primeiro."
      : "O treinador ainda não publicou treinos."
  } else if (opcoesDoMural.tipo === "publicacao") {
    semPosts.textContent = "Ainda não há publicações do treinador."
  } else {
    semPosts.textContent = "Ainda não há postagens. Seja a primeira pessoa a publicar."
  }
  semPosts.hidden = resposta.data.length > 0

  // Se veio o máximo pedido, provavelmente há postagens mais antigas
  botaoMaisPosts.hidden = resposta.data.length < limiteDePosts

  resposta.data.forEach(function (post, posicao) {
    const cartao = criarCartaoDePost(post)
    if (destacarPrimeiro && posicao === 0 && !post.fixado) {
      cartao.classList.add("novo")
    }
    listaPosts.appendChild(cartao)
  })
}

botaoMaisPosts.addEventListener("click", async function () {
  limiteDePosts += POSTS_POR_VEZ
  await mostrarPosts(false)
})

function podeApagarPost(post) {
  if (perfil.id === post.user_id || perfil.papel === "admin") {
    return true
  }
  // O líder modera o mural da própria equipe
  return perfil.papel === "lider" && post.equipe !== null && perfil.equipe === post.equipe
}

// Quem pode fixar: o treinador/líder da equipe (ou o admin) nas postagens da equipe
function podeFixarPost(post) {
  return post.equipe !== null && ehTreinadorDe(post.equipe)
}

async function alternarFixado(post) {
  // O ".select()" devolve as linhas alteradas: se vier vazio, o banco não permitiu
  const resposta = await cliente
    .from("posts")
    .update({ fixado: !post.fixado })
    .eq("id", post.id)
    .select("id")

  if (resposta.error || !resposta.data || resposta.data.length === 0) {
    console.error("Erro ao fixar a postagem:", resposta.error)
    window.alert(
      post.fixado
        ? "Não foi possível desafixar. Tente de novo."
        : "Não foi possível fixar. Lembre que cada seção aceita no máximo 3 itens fixados."
    )
    return
  }
  await mostrarPosts(false)
}

function criarCartaoDePost(post) {
  const cartao = criarElemento("article", post.fixado ? "post post-fixado" : "post")

  // Topo: etiqueta de fixado, nome, data e botões de fixar e apagar
  const topo = criarElemento("div", "post-topo")
  if (post.fixado) {
    topo.appendChild(criarElemento("span", "post-etiqueta", "Fixado"))
  }
  topo.appendChild(criarElemento("span", "post-nome", post.profiles ? post.profiles.nome : "Usuário"))
  topo.appendChild(criarElemento("span", "post-data", formatarData(post.criado_em)))

  // Os botões do topo ficam juntos, à direita
  const acoesTopo = criarElemento("span", "post-acoes-topo")

  if (podeFixarPost(post)) {
    const fixar = criarElemento("button", "botao-texto", post.fixado ? "Desafixar" : "Fixar")
    fixar.type = "button"
    fixar.addEventListener("click", async function () {
      fixar.disabled = true
      await alternarFixado(post)
    })
    acoesTopo.appendChild(fixar)
  }

  if (podeApagarPost(post)) {
    const apagar = criarElemento("button", "botao-texto botao-texto-perigo", "Apagar")
    apagar.type = "button"
    apagar.addEventListener("click", async function () {
      await apagarPost(post)
    })
    acoesTopo.appendChild(apagar)
  }

  if (acoesTopo.childNodes.length > 0) {
    topo.appendChild(acoesTopo)
  }
  cartao.appendChild(topo)

  // Título do treino
  if (post.titulo) {
    cartao.appendChild(criarElemento("h3", "post-titulo", post.titulo))
  }

  // Texto
  if (post.texto) {
    cartao.appendChild(criarElemento("p", "post-texto-conteudo", post.texto))
  }

  // Foto (clicar abre a foto inteira em outra aba)
  if (post.foto_caminho) {
    const link = criarElemento("a", "post-foto-link")
    link.href = enderecoDaFoto(post.foto_caminho)
    link.target = "_blank"
    link.rel = "noopener"

    const imagem = criarElemento("img", "post-foto")
    imagem.loading = "lazy"
    imagem.alt = "Foto postada por " + (post.profiles ? post.profiles.nome : "um usuário")
    imagem.src = enderecoDaFoto(post.foto_caminho)

    link.appendChild(imagem)
    cartao.appendChild(link)
  }

  // Link da planilha do treinador
  if (post.link && linkValido(post.link)) {
    const planilha = criarElemento("a", "botao botao-pequeno botao-contorno post-planilha", "Abrir a planilha")
    planilha.href = post.link
    planilha.target = "_blank"
    planilha.rel = "noopener noreferrer"
    cartao.appendChild(planilha)
  }

  // Rodapé: curtir e comentar
  const comentarios = criarAreaDeComentarios(post)
  const rodape = criarElemento("div", "post-rodape")
  rodape.appendChild(criarBotaoCurtir(post))
  rodape.appendChild(comentarios.botao)
  cartao.appendChild(rodape)
  cartao.appendChild(comentarios.area)

  return cartao
}

async function apagarPost(post) {
  if (!window.confirm("Apagar esta postagem?")) {
    return
  }

  // Primeiro a foto, depois a postagem (a permissão da foto depende da postagem existir)
  if (post.foto_caminho) {
    await cliente.storage.from(PASTA_FOTOS).remove([post.foto_caminho])
  }

  const resposta = await cliente.from("posts").delete().eq("id", post.id)
  if (resposta.error) {
    window.alert("Não foi possível apagar a postagem. Tente de novo.")
    return
  }
  await mostrarPosts(false)
}


// ---------- Curtidas ----------
function criarBotaoCurtir(post) {
  const curtidas = post.curtidas || []
  let euCurti = curtidas.some(function (curtida) {
    return curtida.user_id === perfil.id
  })
  let total = curtidas.length

  const botao = criarElemento("button", "botao-curtir")
  botao.type = "button"
  botao.innerHTML = ICONE_CORACAO

  const contador = criarElemento("span", "curtir-total")
  botao.appendChild(contador)

  // Atualiza o botão sem recarregar a lista inteira
  function atualizar() {
    botao.setAttribute("aria-pressed", String(euCurti))
    botao.setAttribute("aria-label", euCurti ? "Descurtir" : "Curtir")
    contador.textContent = total > 0 ? String(total) : ""
  }
  atualizar()

  botao.addEventListener("click", async function () {
    botao.disabled = true

    let resposta
    if (euCurti) {
      resposta = await cliente
        .from("curtidas")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", perfil.id)
    } else {
      resposta = await cliente.from("curtidas").insert({ post_id: post.id })
    }

    botao.disabled = false

    if (resposta.error) {
      window.alert("Não foi possível salvar sua curtida. Tente de novo.")
      return
    }

    euCurti = !euCurti
    total = euCurti ? total + 1 : total - 1
    atualizar()

    if (euCurti) {
      botao.classList.add("curtiu")
      botao.addEventListener(
        "animationend",
        function () {
          botao.classList.remove("curtiu")
        },
        { once: true }
      )
    }
  })

  return botao
}


// ---------- Comentários nas postagens ----------

// Na Comunidade todo mundo comenta. No mural, só quem é da equipe (ou o admin).
function podeComentar(post) {
  return post.equipe === null || perfil.equipe === post.equipe || perfil.papel === "admin"
}

// Devolve o botão "Comentários" e a área que ele abre (lista + formulário).
// Cada postagem cuida dos próprios comentários, sem recarregar o mural inteiro.
function criarAreaDeComentarios(post) {
  let comentarios = (post.post_comentarios || []).slice()

  const botao = criarElemento("button", "botao-comentarios")
  botao.type = "button"
  botao.setAttribute("aria-expanded", "false")

  const area = criarElemento("div", "post-comentarios")
  area.hidden = true

  const lista = criarElemento("div", "comentarios-lista")
  area.appendChild(lista)

  function atualizarBotao() {
    if (comentarios.length === 0) {
      botao.textContent = "Comentar"
    } else if (comentarios.length === 1) {
      botao.textContent = "1 comentário"
    } else {
      botao.textContent = comentarios.length + " comentários"
    }
  }

  // Quem escreveu, quem fez a postagem, o líder da equipe e o admin podem apagar
  function podeApagarComentario(comentario) {
    return perfil.id === comentario.user_id || podeApagarPost(post)
  }

  function criarComentario(comentario) {
    const caixa = criarElemento("div", "pcomentario")

    const topo = criarElemento("div", "pcomentario-topo")
    topo.appendChild(criarElemento("span", "pcomentario-nome", comentario.profiles ? comentario.profiles.nome : "Usuário"))
    topo.appendChild(criarElemento("span", "post-data", formatarData(comentario.criado_em)))

    if (podeApagarComentario(comentario)) {
      const apagar = criarElemento("button", "botao-texto botao-texto-perigo pcomentario-apagar", "Apagar")
      apagar.type = "button"
      apagar.addEventListener("click", async function () {
        if (!window.confirm("Apagar este comentário?")) {
          return
        }
        const resultado = await cliente.from("post_comentarios").delete().eq("id", comentario.id)
        if (resultado.error) {
          window.alert("Não foi possível apagar o comentário. Tente de novo.")
          return
        }
        await recarregar()
      })
      topo.appendChild(apagar)
    }

    caixa.appendChild(topo)
    caixa.appendChild(criarElemento("p", "pcomentario-texto", comentario.texto))
    return caixa
  }

  function desenharLista() {
    lista.innerHTML = ""
    comentarios.sort(function (a, b) {
      return new Date(a.criado_em) - new Date(b.criado_em)
    })
    comentarios.forEach(function (comentario) {
      lista.appendChild(criarComentario(comentario))
    })
    lista.hidden = comentarios.length === 0
    atualizarBotao()
  }

  async function recarregar() {
    const resposta = await cliente
      .from("post_comentarios")
      .select("id, user_id, texto, criado_em, profiles(nome)")
      .eq("post_id", post.id)
      .order("criado_em", { ascending: true })

    if (!resposta.error) {
      comentarios = resposta.data
      desenharLista()
    }
  }

  // Formulário (ou o aviso, para quem só pode ler)
  if (podeComentar(post)) {
    const formulario = criarElemento("form", "form-comentario")
    formulario.noValidate = true

    const campo = criarElemento("input")
    campo.type = "text"
    campo.maxLength = 300
    campo.placeholder = "Escreva um comentário"
    campo.setAttribute("aria-label", "Escreva um comentário")

    const enviar = criarElemento("button", "botao botao-pequeno", "Enviar")
    enviar.type = "submit"

    formulario.appendChild(campo)
    formulario.appendChild(enviar)
    area.appendChild(formulario)

    formulario.addEventListener("submit", async function (evento) {
      evento.preventDefault()

      const texto = campo.value.trim()
      if (texto === "") {
        return
      }

      ocupado(enviar, true, "Enviar")
      const resultado = await cliente
        .from("post_comentarios")
        .insert({ post_id: post.id, texto: texto })
      ocupado(enviar, false, "Enviar")

      if (resultado.error) {
        window.alert("Não foi possível enviar o comentário. Tente de novo.")
        return
      }

      campo.value = ""
      await recarregar()
      campo.focus()
    })
  } else {
    area.appendChild(criarElemento("p", "vazio", "Só integrantes desta equipe comentam. Você pode ler e curtir."))
  }

  botao.addEventListener("click", function () {
    const abrir = area.hidden
    area.hidden = !abrir
    botao.setAttribute("aria-expanded", String(abrir))

    const campo = area.querySelector("input")
    if (abrir && campo) {
      campo.focus()
    }
  })

  desenharLista()
  return { botao: botao, area: area }
}
