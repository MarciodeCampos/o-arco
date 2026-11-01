/* Filtro do glossário: esconde termos que não contêm o texto digitado. */
(function () {
  const campo = document.getElementById("filtro-glossario");
  if (!campo) return;
  const itens = [...document.querySelectorAll(".glossario dt")];
  const contador = document.getElementById("filtro-contador");
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  campo.addEventListener("input", () => {
    const q = norm(campo.value.trim());
    let visiveis = 0;
    itens.forEach((dt) => {
      const dd = dt.nextElementSibling;
      const ok = !q || norm(dt.textContent + " " + dd.textContent).includes(q);
      dt.hidden = dd.hidden = !ok;
      if (ok) visiveis++;
    });
    document.querySelectorAll(".glossario h3").forEach((h) => {
      const dl = h.nextElementSibling;
      h.hidden = ![...dl.querySelectorAll("dt")].some((dt) => !dt.hidden);
    });
    contador.textContent = q ? `${visiveis} termo(s)` : "";
  });
})();
