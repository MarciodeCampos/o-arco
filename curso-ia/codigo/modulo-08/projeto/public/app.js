// Front-end sem framework e sem build: o foco é o que importa em UX de IA.
//  - streaming: o texto aparece enquanto é gerado
//  - parar: o usuário cancela (e o servidor para de pagar tokens)
//  - textContent, nunca innerHTML com texto do modelo (evita XSS)
//  - estados claros: gerando, erro, cancelado
//  - voz como melhoria progressiva: só aparece se o navegador suportar

const $ = (id) => document.getElementById(id);
const historico = [];
let controlador = null;

// ---------------------------------------------------------------- chat
function adicionarMensagem(role, texto = "") {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = texto; // NUNCA innerHTML: a resposta do modelo pode conter HTML/JS
  $("conversa").append(div);
  $("conversa").scrollTop = $("conversa").scrollHeight;
  return div;
}

function status(id, texto, erro = false) {
  $(id).textContent = texto;
  $(id).classList.toggle("erro", erro);
}

/** Lê um corpo SSE (event:/data:) a partir de um ReadableStream do fetch. */
async function* lerEventos(corpo) {
  const leitor = corpo.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await leitor.read();
    if (done) return;
    buffer += value;
    let fim;
    while ((fim = buffer.indexOf("\n\n")) >= 0) {
      const bloco = buffer.slice(0, fim);
      buffer = buffer.slice(fim + 2);
      const evento = /^event: (.+)$/m.exec(bloco)?.[1];
      const dados = /^data: (.+)$/m.exec(bloco)?.[1];
      if (evento && dados) yield { evento, dados: JSON.parse(dados) };
    }
  }
}

async function enviar(texto) {
  historico.push({ role: "user", content: texto });
  adicionarMensagem("user", texto);
  const bolha = adicionarMensagem("assistant");
  bolha.classList.add("gerando");
  $("enviar").disabled = true;
  $("parar").hidden = false;
  status("status-chat", "Gerando…");
  controlador = new AbortController();
  let resposta = "";
  const inicio = performance.now();
  let primeiro = null;

  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mensagens: historico }),
      signal: controlador.signal,
    });
    if (!r.ok) throw new Error((await r.json()).erro ?? `Erro ${r.status}`);
    for await (const { evento, dados } of lerEventos(r.body)) {
      if (evento === "texto") {
        primeiro ??= performance.now();
        resposta += dados.pedaco;
        bolha.textContent = resposta;
        $("conversa").scrollTop = $("conversa").scrollHeight;
      } else if (evento === "erro") {
        throw new Error(dados.mensagem);
      } else if (evento === "fim") {
        const ttft = primeiro ? ((primeiro - inicio) / 1000).toFixed(1) : "-";
        status("status-chat", `Pronto · 1º token em ${ttft}s · ${dados.tokens} tokens${dados.stop_reason === "max_tokens" ? " · resposta cortada" : ""}`);
      }
    }
    historico.push({ role: "assistant", content: resposta || "(sem resposta)" });
  } catch (e) {
    if (e.name === "AbortError") {
      status("status-chat", "Cancelado.");
      if (resposta) historico.push({ role: "assistant", content: resposta + " [interrompido]" });
      else historico.pop(); // pergunta sem resposta não fica no histórico
    } else {
      status("status-chat", e.message || "Falha de conexão", true);
      historico.pop();
      if (!resposta) bolha.remove();
    }
  } finally {
    bolha.classList.remove("gerando");
    $("enviar").disabled = false;
    $("parar").hidden = true;
    controlador = null;
  }
}

$("form-chat").addEventListener("submit", (e) => {
  e.preventDefault();
  const texto = $("entrada").value.trim();
  if (!texto || controlador) return;
  $("entrada").value = "";
  enviar(texto);
});
$("entrada").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("form-chat").requestSubmit();
  }
});
$("parar").addEventListener("click", () => controlador?.abort());

// ---------------------------------------------------------------- voz (melhoria progressiva)
const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Reconhecimento) {
  $("microfone").hidden = false;
  $("microfone").addEventListener("click", () => {
    const rec = new Reconhecimento();
    rec.lang = "pt-BR";
    rec.onresult = (ev) => ($("entrada").value = ev.results[0][0].transcript);
    rec.onerror = () => status("status-chat", "Não consegui ouvir. Tente de novo ou digite.", true);
    rec.start();
    status("status-chat", "Ouvindo…");
  });
}

// ---------------------------------------------------------------- imagem
const lerComoDataUrl = (arquivo) =>
  new Promise((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result);
    leitor.onerror = erro;
    leitor.readAsDataURL(arquivo);
  });

$("arquivo").addEventListener("change", () => {
  const arq = $("arquivo").files[0];
  if (!arq) return;
  if (arq.size > 4 * 1024 * 1024) {
    status("status-img", "Imagem acima de 4 MB: reduza antes de enviar.", true);
    $("arquivo").value = "";
    return;
  }
  $("previa").src = URL.createObjectURL(arq);
  $("previa").hidden = false;
  status("status-img", "");
});

$("form-imagem").addEventListener("submit", async (e) => {
  e.preventDefault();
  const arq = $("arquivo").files[0];
  if (!arq) return;
  $("analisar").disabled = true;
  $("resultado").hidden = true;
  status("status-img", "Analisando…");
  try {
    const r = await fetch("/api/analisar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imagem: await lerComoDataUrl(arq), pergunta: $("pergunta-img").value || undefined }),
    });
    const corpo = await r.json();
    if (!r.ok) throw new Error(corpo.erro);
    const a = corpo.analise;
    $("r-tipo").textContent = a.tipo;
    $("r-confianca").textContent = a.confianca;
    $("r-descricao").textContent = a.descricao;
    $("r-valores").replaceChildren(
      ...a.valores.map(({ rotulo, valor }) => {
        const tr = document.createElement("tr");
        for (const t of [rotulo, valor]) {
          const td = document.createElement("td");
          td.textContent = t;
          tr.append(td);
        }
        return tr;
      }),
    );
    $("r-alertas").replaceChildren(
      ...a.alertas.map((t) => Object.assign(document.createElement("li"), { textContent: t })),
    );
    $("resultado").hidden = false;
    status("status-img", "Pronto.");
  } catch (err) {
    status("status-img", err.message || "Falha ao analisar", true);
  } finally {
    $("analisar").disabled = false;
  }
});
