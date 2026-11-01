/**
 * Divide documentos Markdown em trechos (chunks) para indexação.
 *
 * Estratégia: um trecho por seção (## título). Seções longas são quebradas por
 * parágrafo, com sobreposição. Cada trecho ganha um "cabeçalho de contexto"
 * (documento + seção) no texto que vai para o embedding: um parágrafo solto como
 * "Não há fidelidade" não diz de QUE assinatura está falando; com o cabeçalho, diz.
 */

export interface Trecho {
  /** Estável entre reindexações: "arquivo#slug-da-secao" (+ "-2", "-3" se a seção foi dividida). */
  id: string;
  doc: string;
  tituloDoc: string;
  secao: string;
  /** O texto exibido e citado. */
  texto: string;
  /** O texto que vai para o embedding e para a busca textual (com cabeçalho de contexto). */
  textoIndexado: string;
}

export interface OpcoesChunking {
  maxCaracteres?: number;
  sobreposicaoParagrafos?: number;
}

export const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function dividirMarkdown(arquivo: string, markdown: string, opcoes: OpcoesChunking = {}): Trecho[] {
  const max = opcoes.maxCaracteres ?? 1200;
  const sobreposicao = opcoes.sobreposicaoParagrafos ?? 1;
  const doc = arquivo.replace(/\.md$/, "");
  const tituloDoc = markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? doc;

  // Quebra em seções pelos títulos de nível 2.
  const secoes: { titulo: string; corpo: string }[] = [];
  let atual = { titulo: "Introdução", corpo: "" };
  for (const linha of markdown.split("\n")) {
    const h2 = linha.match(/^##\s+(.+)$/);
    if (h2) {
      if (atual.corpo.trim()) secoes.push(atual);
      atual = { titulo: h2[1].trim(), corpo: "" };
    } else if (!/^#\s/.test(linha) && !/^>\s/.test(linha)) {
      atual.corpo += linha + "\n";
    }
  }
  if (atual.corpo.trim()) secoes.push(atual);

  const trechos: Trecho[] = [];
  for (const { titulo, corpo } of secoes) {
    const base = `${doc}#${slug(titulo)}`;
    const pedacos = quebrarPorParagrafos(corpo.trim(), max, sobreposicao);
    pedacos.forEach((texto, i) => {
      trechos.push({
        id: i === 0 ? base : `${base}-${i + 1}`,
        doc,
        tituloDoc,
        secao: titulo,
        texto,
        textoIndexado: `${tituloDoc} — ${titulo}\n\n${texto}`,
      });
    });
  }
  return trechos;
}

/** Junta parágrafos até o limite; repete os últimos `sobreposicao` parágrafos no início do próximo pedaço. */
export function quebrarPorParagrafos(texto: string, max: number, sobreposicao: number): string[] {
  if (texto.length <= max) return [texto];
  // Tabelas e listas ficam inteiras: só quebramos em linhas em branco.
  const paragrafos = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const pedacos: string[] = [];
  let atual: string[] = [];
  for (const p of paragrafos) {
    const candidato = [...atual, p].join("\n\n");
    if (candidato.length > max && atual.length) {
      pedacos.push(atual.join("\n\n"));
      atual = [...atual.slice(-sobreposicao), p];
    } else {
      atual.push(p);
    }
  }
  if (atual.length) pedacos.push(atual.join("\n\n"));
  return pedacos;
}
