/* Calculadora de custo da aula P1.4. Estimativa grosseira: ~1,5 token por palavra. */
(function () {
  const form = document.getElementById("calc");
  if (!form) return;
  // US$ por milhão de tokens (entrada, saída) — preços da API em out/2026
  const MODELOS = [
    ["Fable 5.1", 10, 50], ["Opus 5.5", 4, 20], ["Sonnet 5.5", 2, 10], ["Haiku 5.5", 0.1, 0.5],
  ];
  const TOKENS_POR_PALAVRA = 1.5;
  const saida = document.getElementById("calc-saida");
  const fmt = (v) => v > 0 && v < 0.01 ? "< US$ 0,01" : "US$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function calcular() {
    const n = (id) => Math.max(0, Number(form.elements[id].value) || 0);
    const entrada = n("entrada") * TOKENS_POR_PALAVRA, resposta = n("resposta") * TOKENS_POR_PALAVRA;
    const porMes = n("tarefas") * 22;
    saida.replaceChildren();
    for (const [nome, pe, ps] of MODELOS) {
      const porTarefa = (entrada * pe + resposta * ps) / 1e6;
      const tr = document.createElement("tr");
      for (const t of [nome, fmt(porTarefa), fmt(porTarefa * porMes)]) {
        const td = document.createElement("td"); td.textContent = t; tr.appendChild(td);
      }
      saida.appendChild(tr);
    }
  }
  form.addEventListener("input", calcular);
  calcular();
})();
