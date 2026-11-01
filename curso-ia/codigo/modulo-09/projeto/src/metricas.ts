/** Agrega os registros do gateway em métricas de operação: o que um painel de LLMOps mostra. */
import type { Registro } from "./gateway.js";

const percentil = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor(p * o.length))];
};

export function calcularMetricas(registros: Registro[]) {
  const ok = registros.filter((r) => r.status === "ok");
  const chamadas = ok.filter((r) => !r.cache);
  const agrupar = <K extends string>(chave: (r: Registro) => K) => {
    const g: Record<string, { requisicoes: number; custoUsd: number }> = {};
    for (const r of ok) {
      const k = chave(r);
      g[k] ??= { requisicoes: 0, custoUsd: 0 };
      g[k].requisicoes++;
      g[k].custoUsd += r.custoUsd;
    }
    return g;
  };
  return {
    requisicoes: registros.length,
    erros: registros.filter((r) => r.status === "erro").length,
    recusadasPorCota: registros.filter((r) => r.status === "recusado_cota").length,
    taxaCache: ok.length ? ok.filter((r) => r.cache).length / ok.length : 0,
    usaramReserva: ok.filter((r) => r.tentativas.length > 1).length,
    latenciaMs: { p50: percentil(chamadas.map((r) => r.latenciaMs), 0.5), p95: percentil(chamadas.map((r) => r.latenciaMs), 0.95) },
    custoTotalUsd: ok.reduce((s, r) => s + r.custoUsd, 0),
    porCliente: agrupar((r) => r.cliente),
    porModelo: agrupar((r) => r.modelo ?? "cache"),
    porVersaoPrompt: agrupar((r) => `${r.tarefa}@${r.versaoPrompt}`),
  };
}
