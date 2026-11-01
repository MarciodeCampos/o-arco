const usd = (v) => `US$ ${v.toFixed(4)}`;
const el = (tag, texto, classe) => Object.assign(document.createElement(tag), { textContent: texto, className: classe ?? "" });

function tabela(id, grupos) {
  const max = Math.max(...Object.values(grupos).map((g) => g.custoUsd), 1e-9);
  const linhas = Object.entries(grupos).sort((a, b) => b[1].custoUsd - a[1].custoUsd);
  const cab = document.createElement("tr");
  for (const [t, c] of [["Nome"], ["Requisições", "n"], ["Custo", "n"], [""]]) cab.append(el("th", t, c));
  const trs = linhas.map(([nome, g]) => {
    const tr = document.createElement("tr");
    tr.append(el("td", nome), el("td", String(g.requisicoes), "n"), el("td", usd(g.custoUsd), "n"));
    const td = document.createElement("td");
    const barra = el("div", "", "barra");
    barra.style.width = `${(g.custoUsd / max) * 100}%`;
    td.append(barra);
    tr.append(td);
    return tr;
  });
  document.getElementById(id).replaceChildren(cab, ...trs);
}

async function atualizar() {
  try {
    const m = await (await fetch("/v1/metricas")).json();
    const kpis = [
      [usd(m.custoTotalUsd), "custo total"],
      [String(m.requisicoes), "requisições"],
      [`${(m.taxaCache * 100).toFixed(0)}%`, "respostas do cache"],
      [`${m.latenciaMs.p50} / ${m.latenciaMs.p95} ms`, "latência p50 / p95"],
      [String(m.usaramReserva), "usaram modelo reserva"],
      [`${m.erros} / ${m.recusadasPorCota}`, "erros / recusadas por cota"],
    ];
    document.getElementById("kpis").replaceChildren(
      ...kpis.map(([v, r]) => {
        const d = el("div", "", "kpi");
        d.append(el("b", v), el("span", r));
        return d;
      }),
    );
    tabela("clientes", m.porCliente);
    tabela("modelos", m.porModelo);
    tabela("versoes", m.porVersaoPrompt);
    document.getElementById("hora").textContent = new Date().toLocaleTimeString("pt-BR");
  } catch {
    document.getElementById("hora").textContent = "sem conexão com o gateway";
  }
}
atualizar();
setInterval(atualizar, 5000);
