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


// ---------- Começo ----------
// Chame com null (Comunidade) ou com o nome da equipe (mural da equipe)
function iniciarMural(nomeDaEquipe) {
  equipeDoMural = nomeDaEquipe
  limiteDePosts = POSTS_POR_VEZ

  // Na Comunidade todo mundo publica. No mural, só quem é da equipe (ou o admin).
  const podePublicar =
    nomeDaEquipe === null || perfil.equipe === nomeDaEquipe || perfil.papel === "admin"

  formPost.hidden = !podePublicar
  avisoMural.hidden = podePublicar

  mostrarPosts(false)
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
  if (texto === "" && !fotoEscolhida) {
    msgPost.textContent = "Escreva uma mensagem ou escolha uma foto."
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
  const resposta = await cliente
    .from("posts")
    .insert({ equipe: equipeDoMural, texto: texto, foto_caminho: caminho })

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
  limparFotoEscolhida()
  await mostrarPosts(true)
})


// ---------- Lista de postagens ----------
async function mostrarPosts(destacarPrimeiro) {
  let consulta = cliente
    .from("posts")
    .select("id, user_id, equipe, texto, foto_caminho, criado_em, profiles(nome), curtidas(user_id)")

  if (equipeDoMural === null) {
    consulta = consulta.is("equipe", null)
  } else {
    consulta = consulta.eq("equipe", equipeDoMural)
  }

  const resposta = await consulta
    .order("criado_em", { ascending: false })
    .limit(limiteDePosts)

  listaPosts.innerHTML = ""

  if (resposta.error) {
    semPosts.textContent = "Não foi possível carregar as postagens agora."
    semPosts.hidden = false
    botaoMaisPosts.hidden = true
    return
  }

  semPosts.textContent = "Ainda não há postagens. Seja a primeira pessoa a publicar."
  semPosts.hidden = resposta.data.length > 0

  // Se veio o máximo pedido, provavelmente há postagens mais antigas
  botaoMaisPosts.hidden = resposta.data.length < limiteDePosts

  resposta.data.forEach(function (post, posicao) {
    const cartao = criarCartaoDePost(post)
    if (destacarPrimeiro && posicao === 0) {
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

function criarCartaoDePost(post) {
  const cartao = criarElemento("article", "post")

  // Topo: nome, data e botão de apagar
  const topo = criarElemento("div", "post-topo")
  topo.appendChild(criarElemento("span", "post-nome", post.profiles ? post.profiles.nome : "Usuário"))
  topo.appendChild(criarElemento("span", "post-data", formatarData(post.criado_em)))

  if (podeApagarPost(post)) {
    const apagar = criarElemento("button", "botao-texto botao-texto-perigo post-apagar", "Apagar")
    apagar.type = "button"
    apagar.addEventListener("click", async function () {
      await apagarPost(post)
    })
    topo.appendChild(apagar)
  }
  cartao.appendChild(topo)

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

  cartao.appendChild(criarBotaoCurtir(post))
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
