// =========================================================
// CONECTING CORRIDORS - ETAPA 1
//
// IMPORTANTE: nesta etapa tudo é salvo só no navegador
// (localStorage), para você ver como o site está ficando.
// Na próxima etapa vamos trocar isso pelo banco de dados
// (Supabase), com login de verdade e dados compartilhados
// entre todos os usuários.
// =========================================================


// ---------- Nomes das "gavetas" onde guardamos os dados ----------
const CHAVE_USUARIOS = "cc_usuarios";
const CHAVE_SESSAO = "cc_sessao";
const CHAVE_COMENTARIOS = "cc_comentarios";
const CHAVE_SUGESTOES = "cc_sugestoes";


// ---------- Elementos da página ----------
const telaLogin = document.getElementById("tela-login");
const telaSite = document.getElementById("tela-site");

const abaEntrar = document.getElementById("aba-entrar");
const abaCriar = document.getElementById("aba-criar");
const formEntrar = document.getElementById("form-entrar");
const formCriar = document.getElementById("form-criar");
const msgEntrar = document.getElementById("msg-entrar");
const msgCriar = document.getElementById("msg-criar");

const botaoSair = document.getElementById("botao-sair");
const nomeUsuario = document.getElementById("nome-usuario");

const equipeTiles = document.querySelectorAll(".equipe-tile");
const avisoEquipe = document.getElementById("aviso-equipe");

const formComentario = document.getElementById("form-comentario");
const comentarioTexto = document.getElementById("comentario-texto");
const listaComentarios = document.getElementById("lista-comentarios");
const semComentarios = document.getElementById("sem-comentarios");

const formSugestao = document.getElementById("form-sugestao");
const sugestaoTexto = document.getElementById("sugestao-texto");
const msgSugestao = document.getElementById("msg-sugestao");


// ---------- Funções para ler e salvar listas ----------
function lerLista(chave) {
  try {
    return JSON.parse(localStorage.getItem(chave)) || [];
  } catch (erro) {
    return [];
  }
}

function salvarLista(chave, lista) {
  localStorage.setItem(chave, JSON.stringify(lista));
}

// Devolve o usuário que está logado (ou undefined se ninguém estiver)
function usuarioAtual() {
  const emailLogado = localStorage.getItem(CHAVE_SESSAO);
  const usuarios = lerLista(CHAVE_USUARIOS);
  return usuarios.find(function (usuario) {
    return usuario.email === emailLogado;
  });
}

// Salva as mudanças feitas num usuário (por exemplo, a equipe escolhida)
function atualizarUsuario(usuarioMudado) {
  const usuarios = lerLista(CHAVE_USUARIOS);
  const posicao = usuarios.findIndex(function (usuario) {
    return usuario.email === usuarioMudado.email;
  });
  if (posicao !== -1) {
    usuarios[posicao] = usuarioMudado;
    salvarLista(CHAVE_USUARIOS, usuarios);
  }
}


// ---------- Mostrar a tela certa ----------
function mostrarTela() {
  const usuario = usuarioAtual();

  if (usuario) {
    telaLogin.hidden = true;
    telaSite.hidden = false;
    nomeUsuario.textContent = usuario.nome;
    marcarEquipe(usuario.equipe);
    mostrarComentarios(false);
  } else {
    telaLogin.hidden = false;
    telaSite.hidden = true;
  }
}


// ---------- Login e cadastro ----------
function trocarAba(aba) {
  const entrando = aba === "entrar";

  formEntrar.hidden = !entrando;
  formCriar.hidden = entrando;
  abaEntrar.setAttribute("aria-selected", String(entrando));
  abaCriar.setAttribute("aria-selected", String(!entrando));
  msgEntrar.textContent = "";
  msgCriar.textContent = "";
}

abaEntrar.addEventListener("click", function () {
  trocarAba("entrar");
});

abaCriar.addEventListener("click", function () {
  trocarAba("criar");
});

formCriar.addEventListener("submit", function (evento) {
  evento.preventDefault();

  const nome = document.getElementById("criar-nome").value.trim();
  const email = document.getElementById("criar-email").value.trim().toLowerCase();
  const senha = document.getElementById("criar-senha").value;

  if (nome.length < 3) {
    msgCriar.textContent = "O nome de usuário precisa ter pelo menos 3 caracteres.";
    return;
  }
  if (email === "" || !email.includes("@")) {
    msgCriar.textContent = "Digite um email válido.";
    return;
  }
  if (senha.length < 6) {
    msgCriar.textContent = "A senha precisa ter pelo menos 6 caracteres.";
    return;
  }

  const usuarios = lerLista(CHAVE_USUARIOS);

  const emailJaExiste = usuarios.some(function (usuario) {
    return usuario.email === email;
  });
  if (emailJaExiste) {
    msgCriar.textContent = "Já existe uma conta com esse email. Use a aba Entrar.";
    return;
  }

  const nomeJaExiste = usuarios.some(function (usuario) {
    return usuario.nome.toLowerCase() === nome.toLowerCase();
  });
  if (nomeJaExiste) {
    msgCriar.textContent = "Esse nome de usuário já está em uso. Escolha outro.";
    return;
  }

  // ATENÇÃO: guardar a senha assim é só para teste. Na etapa do
  // Supabase o próprio serviço protege as senhas.
  usuarios.push({ nome: nome, email: email, senha: senha, equipe: "" });
  salvarLista(CHAVE_USUARIOS, usuarios);

  localStorage.setItem(CHAVE_SESSAO, email);
  formCriar.reset();
  mostrarTela();
  window.scrollTo(0, 0);
});

formEntrar.addEventListener("submit", function (evento) {
  evento.preventDefault();

  const email = document.getElementById("entrar-email").value.trim().toLowerCase();
  const senha = document.getElementById("entrar-senha").value;

  const usuarios = lerLista(CHAVE_USUARIOS);
  const usuario = usuarios.find(function (item) {
    return item.email === email;
  });

  if (!usuario) {
    msgEntrar.textContent = "Esse email ainda não tem conta. Use a aba Criar conta.";
    return;
  }
  if (usuario.senha !== senha) {
    msgEntrar.textContent = "Senha incorreta. Confira e tente de novo.";
    return;
  }

  localStorage.setItem(CHAVE_SESSAO, email);
  formEntrar.reset();
  mostrarTela();
  window.scrollTo(0, 0);
});

botaoSair.addEventListener("click", function () {
  localStorage.removeItem(CHAVE_SESSAO);
  trocarAba("entrar");
  mostrarTela();
  window.scrollTo(0, 0);
});


// ---------- Escolha da equipe ----------
function marcarEquipe(equipeEscolhida) {
  equipeTiles.forEach(function (tile) {
    const selecionada = tile.dataset.equipe === equipeEscolhida;
    tile.classList.toggle("selecionada", selecionada);
    tile.setAttribute("aria-pressed", String(selecionada));
  });

  if (equipeEscolhida) {
    avisoEquipe.textContent =
      "Você escolheu a " + equipeEscolhida + ". A página da equipe, com treinos e integrantes, chega na próxima etapa.";
  } else {
    avisoEquipe.textContent = "";
  }
}

equipeTiles.forEach(function (tile) {
  tile.addEventListener("click", function () {
    const usuario = usuarioAtual();
    if (!usuario) {
      return;
    }
    usuario.equipe = tile.dataset.equipe;
    atualizarUsuario(usuario);
    marcarEquipe(usuario.equipe);
  });
});

// Se a foto da equipe ainda não existir, esconde a imagem quebrada
// e deixa aparecer o fundo azul com o nome da equipe.
document.querySelectorAll(".equipe-tile img").forEach(function (imagem) {
  function esconderImagem() {
    imagem.hidden = true;
  }
  imagem.addEventListener("error", esconderImagem);
  if (imagem.complete && imagem.naturalWidth === 0) {
    esconderImagem();
  }
});


// ---------- Comentários da comunidade ----------
function formatarData(milissegundos) {
  return new Date(milissegundos).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Desenha a lista de comentários. Se "destacarPrimeiro" for true,
// o comentário mais recente aparece com uma pequena animação.
function mostrarComentarios(destacarPrimeiro) {
  const comentarios = lerLista(CHAVE_COMENTARIOS);
  listaComentarios.innerHTML = "";
  semComentarios.hidden = comentarios.length > 0;

  // O mais novo fica no topo
  comentarios
    .slice()
    .reverse()
    .forEach(function (comentario, posicao) {
      const caixa = document.createElement("article");
      caixa.className = "comentario";
      if (destacarPrimeiro && posicao === 0) {
        caixa.classList.add("novo");
      }

      const topo = document.createElement("div");
      topo.className = "comentario-topo";

      const nome = document.createElement("span");
      nome.className = "comentario-nome";
      nome.textContent = comentario.nome;

      const data = document.createElement("span");
      data.className = "comentario-data";
      data.textContent = formatarData(comentario.data);

      const texto = document.createElement("p");
      texto.className = "comentario-texto";
      texto.textContent = comentario.texto;

      topo.appendChild(nome);
      topo.appendChild(data);
      caixa.appendChild(topo);
      caixa.appendChild(texto);
      listaComentarios.appendChild(caixa);
    });
}

formComentario.addEventListener("submit", function (evento) {
  evento.preventDefault();

  const usuario = usuarioAtual();
  const texto = comentarioTexto.value.trim();
  if (!usuario || texto === "") {
    return;
  }

  const comentarios = lerLista(CHAVE_COMENTARIOS);
  comentarios.push({ nome: usuario.nome, texto: texto, data: Date.now() });
  salvarLista(CHAVE_COMENTARIOS, comentarios);

  comentarioTexto.value = "";
  mostrarComentarios(true);
});


// ---------- Sugestões ----------
formSugestao.addEventListener("submit", function (evento) {
  evento.preventDefault();

  const usuario = usuarioAtual();
  const texto = sugestaoTexto.value.trim();

  if (texto === "") {
    msgSugestao.classList.remove("ok");
    msgSugestao.textContent = "Escreva sua sugestão antes de enviar.";
    return;
  }

  const sugestoes = lerLista(CHAVE_SUGESTOES);
  sugestoes.push({
    nome: usuario ? usuario.nome : "",
    email: usuario ? usuario.email : "",
    texto: texto,
    data: Date.now()
  });
  salvarLista(CHAVE_SUGESTOES, sugestoes);

  sugestaoTexto.value = "";
  msgSugestao.classList.add("ok");
  msgSugestao.textContent = "Sugestão enviada. Obrigado por ajudar a melhorar o site.";
});


// ---------- Começo: decide qual tela mostrar ----------
mostrarTela();
