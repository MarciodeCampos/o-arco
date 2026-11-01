/* Curso de Engenharia de IA Aplicada — interações sem dependências.
   - Renderiza o currículo (capa) a partir de curriculo.json
   - Quiz de múltipla escolha, botões de copiar código
   - Progresso por aula salvo no navegador (localStorage, opcional) */
(function () {
  "use strict";

  const CHAVE = "curso-ia:progresso";

  function lerProgresso() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE) || "{}");
    } catch (_) {
      return {};
    }
  }
  function salvarProgresso(p) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(p));
    } catch (_) {
      /* modo privado ou armazenamento bloqueado: segue sem salvar */
    }
  }

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ---------------- capa: currículo ---------------- */
  async function renderizarCurriculo() {
    const alvo = document.getElementById("curriculo");
    if (!alvo) return;
    let dados;
    try {
      const r = await fetch("curriculo.json", { cache: "no-cache" });
      dados = await r.json();
    } catch (_) {
      alvo.innerHTML = '<p class="sub">Não foi possível carregar o currículo. Recarregue a página.</p>';
      return;
    }
    const progresso = lerProgresso();
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set("stat-modulos", dados.modulos.length);
    set("stat-horas", dados.cargaHorariaTotal + "h");
    set("stat-prontos", dados.modulos.filter((m) => m.status === "pronto").length);

    const cartao = (m, rotulo) => {
        const pronto = m.status === "pronto";
        const feitas = Object.keys(progresso).filter((k) => k.startsWith(m.slug + "/")).length;
        const titulo = pronto ? `<a href="${m.slug}/">${esc(m.titulo)}</a>` : esc(m.titulo);
        const tags = [
          `<span class="tag">${m.horas}h</span>`,
          pronto ? '<span class="tag ok">Disponível</span>' : '<span class="tag soon">Em produção</span>',
          m.novo ? '<span class="tag new">Novo</span>' : "",
          pronto && feitas ? `<span class="tag ok">${feitas}/${m.aulas || m.unidades.length} aulas feitas</span>` : "",
        ].join("");
        const melhorias = m.melhorias && m.melhorias.length
          ? `<p class="melh">Melhorias em relação à ementa original: ${m.melhorias.map(esc).join("; ")}.</p>` : "";
        return `
        <article class="mod${pronto ? " ready" : ""}">
          <div class="mod-num">${esc(rotulo)}</div>
          <div>
            <h3>${titulo}</h3>
            <div class="tags">${tags}</div>
            <p>${esc(m.resumo)}</p>
            <details class="units">
              <summary>${m.unidades.length} unidades · projeto${melhorias ? " · o que mudou" : ""}</summary>
              <ol>${m.unidades.map((u) => `<li>${esc(u)}</li>`).join("")}</ol>
              <p class="proj"><b>Projeto:</b> ${esc(m.projeto)}</p>
              ${melhorias}
            </details>
          </div>
        </article>`;
    };
    const pre = document.getElementById("preliminares");
    if (pre && dados.preliminares) {
      pre.innerHTML = dados.preliminares.map((m) => cartao(m, "P" + m.numero)).join("");
    }
    alvo.innerHTML = dados.modulos
      .map((m) => cartao(m, String(m.numero).padStart(2, "0")))
      .join("");
  }

  /* ---------------- quiz ---------------- */
  function iniciarQuiz() {
    document.querySelectorAll(".q").forEach((q) => {
      const botoes = q.querySelectorAll("button");
      botoes.forEach((b) =>
        b.addEventListener("click", () => {
          botoes.forEach((x) => {
            x.disabled = true;
            if (x.hasAttribute("data-certa")) x.classList.add("right");
          });
          if (!b.hasAttribute("data-certa")) b.classList.add("wrong");
          q.classList.add("answered");
        }),
      );
    });
  }


  /* ---------------- Windows PowerShell ----------------
   * Muitos alunos usam o Windows PowerShell 5.1, que não aceita "&&", "export" nem
   * "source". Para cada bloco bash simples, gera a versão PowerShell (um comando por
   * linha) dentro de um <details>. Blocos que não dá para converter com segurança
   * ganham só um aviso com link para a tabela de equivalências (P2.5).
   */
  const NAO_CONVERTE = /\|\s*(head|tail|grep|wc|jq|sed|awk)\b|\$\(|\\\s*$|<<|\/dev\/null|\brm -rf\b|\bchmod\b|^\s*[A-Z_]+=\S+\s|\bcurl\b|\bsudo\b|\bapt\b|\bbrew\b/m;
  const PRECISA = /&&|\bexport [A-Z_]+=|\bsource \S+|\bpython3\b|echo \$\?/;

  function linhaParaPowerShell(linha) {
    const m = linha.match(/^(.*?)(\s+#.*)?$/);
    const codigo = m[1];
    const comentario = (m[2] || "").trim();
    if (!codigo.trim()) return [linha];
    const partes = codigo.split("&&").map((p) =>
      p
        .trim()
        .replace(/^export ([A-Z_][A-Z0-9_]*)=(.*)$/, "$$env:$1 = $2")
        .replace(/^source (\S+)\/bin\/activate$/, (_, d) => `${d.replace(/\//g, "\\")}\\Scripts\\Activate.ps1`)
        .replace(/\bpython3\b/g, "python")
        .replace(/;\s*echo \$\?$/, "; $$LASTEXITCODE")
        .replace(/^echo \$\?$/, "$$LASTEXITCODE"),
    );
    if (!comentario) return partes;
    // Um comando só: o comentário fica na mesma linha. Vários: vai antes, para valer para todos.
    if (partes.length === 1) return [partes[0] + "   " + comentario];
    return [comentario, ...partes];
  }

  function iniciarPowerShell() {
    if (document.querySelector(".content[data-modulo='pre-02']")) return;
    const tabela = "../pre-02/#aula-5";
    document.querySelectorAll('pre[data-lang="bash"]').forEach((pre) => {
      const original = (pre.querySelector("code") || pre).textContent;
      if (!PRECISA.test(original)) return;
      const bloco = document.createElement("details");
      bloco.className = "pwsh";
      if (NAO_CONVERTE.test(original)) {
        bloco.innerHTML = `<summary>No Windows PowerShell</summary><p>Este bloco usa recursos do bash. Use o Git Bash ou o WSL, ou adapte com a <a href="${tabela}">tabela de equivalências</a>.</p>`;
      } else {
        const ps = original.split("\n").flatMap(linhaParaPowerShell).join("\n");
        const novo = document.createElement("pre");
        novo.setAttribute("data-lang", "powershell");
        const code = document.createElement("code");
        code.textContent = ps;
        novo.appendChild(code);
        bloco.innerHTML = `<summary>No Windows PowerShell</summary><p>O PowerShell 5.1 não aceita <code>&amp;&amp;</code>: rode um comando por linha e confira se cada um terminou sem erro antes do próximo. Outras diferenças na <a href="${tabela}">tabela de equivalências</a>.</p>`;
        bloco.appendChild(novo);
      }
      pre.insertAdjacentElement("afterend", bloco);
    });
  }

  /* ---------------- copiar código ---------------- */
  function iniciarCopiar() {
    document.querySelectorAll("pre").forEach((pre) => {
      const b = document.createElement("button");
      b.className = "copy";
      b.type = "button";
      b.textContent = "copiar";
      b.addEventListener("click", async () => {
        const texto = pre.querySelector("code")?.innerText ?? pre.innerText;
        try {
          await navigator.clipboard.writeText(texto);
          b.textContent = "copiado";
        } catch (_) {
          b.textContent = "erro";
        }
        setTimeout(() => (b.textContent = "copiar"), 1500);
      });
      pre.appendChild(b);
    });
  }

  /* ---------------- progresso das aulas + sumário ---------------- */
  function iniciarModulo() {
    const conteudo = document.querySelector(".content[data-modulo]");
    if (!conteudo) return;
    const modulo = conteudo.dataset.modulo;
    const aulas = [...document.querySelectorAll(".lesson[id]")];
    const progresso = lerProgresso();
    const pill = document.querySelector(".progress-pill");

    function atualizar() {
      const feitas = aulas.filter((a) => progresso[`${modulo}/${a.id}`]).length;
      if (pill) pill.textContent = `${feitas}/${aulas.length} aulas`;
      aulas.forEach((a) => {
        const feito = !!progresso[`${modulo}/${a.id}`];
        const link = document.querySelector(`.toc a[href="#${a.id}"] .chk`);
        if (link) link.textContent = feito ? "✓" : "";
        const btn = a.querySelector(".done-btn");
        if (btn) {
          btn.classList.toggle("is-done", feito);
          btn.textContent = feito ? "✓ Aula concluída" : "Marcar aula como concluída";
        }
      });
    }

    aulas.forEach((a) => {
      const btn = document.createElement("button");
      btn.className = "done-btn";
      btn.type = "button";
      btn.addEventListener("click", () => {
        const k = `${modulo}/${a.id}`;
        if (progresso[k]) delete progresso[k];
        else progresso[k] = Date.now();
        salvarProgresso(progresso);
        atualizar();
      });
      a.appendChild(btn);
    });
    atualizar();

    // destaca no sumário a aula visível
    const links = new Map([...document.querySelectorAll(".toc a")].map((l) => [l.getAttribute("href").slice(1), l]));
    const obs = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            links.get(e.target.id)?.classList.add("active");
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    document.querySelectorAll(".content section[id]").forEach((s) => obs.observe(s));

    // sumário recolhível no celular
    const toc = document.querySelector(".toc");
    toc?.querySelector(".toc-toggle")?.addEventListener("click", () => toc.classList.toggle("open"));
    toc?.querySelectorAll("a").forEach((l) => l.addEventListener("click", () => toc.classList.remove("open")));
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderizarCurriculo();
    iniciarQuiz();
    iniciarPowerShell();
    iniciarCopiar();
    iniciarModulo();
  });
})();
