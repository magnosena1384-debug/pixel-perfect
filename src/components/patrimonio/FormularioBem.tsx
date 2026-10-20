import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Seletor } from "@/components/gestao/ui";
import { reaisParaCentavos } from "@/lib/gestao";
import type { DadosBem } from "@/lib/patrimonio/dados";
import { CATEGORIAS, vidaUtilSugerida } from "@/lib/patrimonio/regras";

const SITUACOES = { em_uso: "Em uso", com_defeito: "Com defeito" } as const;

const centavosParaTexto = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formulário do bem, usado no cadastro e na edição. A empresa fica fora: só muda por transferência. */
export function FormularioBem({
  inicial,
  comSituacao,
  gravando,
  rotulo,
  aoGravar,
  antesDosCampos,
}: {
  inicial?: DadosBem;
  comSituacao?: boolean;
  gravando: boolean;
  rotulo: string;
  aoGravar: (dados: DadosBem) => void;
  antesDosCampos?: React.ReactNode;
}) {
  const [f, setF] = useState({
    nome: inicial?.nome ?? "",
    categoria: inicial?.categoria ?? CATEGORIAS[0],
    setor: inicial?.setor ?? "",
    marca: inicial?.marca ?? "",
    modelo: inicial?.modelo ?? "",
    numeroSerie: inicial?.numeroSerie ?? "",
    dataCompra: inicial?.dataCompra ?? "",
    valor: inicial ? centavosParaTexto(inicial.valorCompra) : "",
    vidaUtil: String(inicial?.vidaUtilAnos ?? vidaUtilSugerida(CATEGORIAS[0])),
    situacao: inicial?.situacao ?? "em_uso",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    aoGravar({
      nome: f.nome.trim(),
      categoria: f.categoria,
      setor: f.setor.trim(),
      marca: f.marca.trim(),
      modelo: f.modelo.trim(),
      numeroSerie: f.numeroSerie.trim(),
      dataCompra: f.dataCompra,
      valorCompra: reaisParaCentavos(f.valor),
      vidaUtilAnos: Number(f.vidaUtil),
      situacao: f.situacao as DadosBem["situacao"],
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {antesDosCampos}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Nome / descrição" className="sm:col-span-2">
          <Input value={f.nome} onChange={set("nome")} required />
        </Campo>
        <Campo label="Categoria">
          <Seletor
            opcoes={[...CATEGORIAS]}
            value={f.categoria}
            onChange={(e) =>
              setF({
                ...f,
                categoria: e.target.value,
                vidaUtil: String(vidaUtilSugerida(e.target.value)),
              })
            }
          />
        </Campo>
        <Campo label="Setor">
          <Input
            value={f.setor}
            onChange={set("setor")}
            placeholder="Ex.: Pista, Loja, Escritório"
          />
        </Campo>
        <Campo label="Marca">
          <Input value={f.marca} onChange={set("marca")} />
        </Campo>
        <Campo label="Modelo">
          <Input value={f.modelo} onChange={set("modelo")} />
        </Campo>
        <Campo label="Nº de série (recomendado)">
          <Input value={f.numeroSerie} onChange={set("numeroSerie")} />
        </Campo>
        <Campo label="Data de compra">
          <Input type="date" value={f.dataCompra} onChange={set("dataCompra")} required />
        </Campo>
        <Campo label="Valor de compra (R$)">
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={f.valor}
            onChange={set("valor")}
            required
          />
        </Campo>
        <Campo label="Vida útil (anos)">
          <Input
            type="number"
            min={0}
            max={100}
            value={f.vidaUtil}
            onChange={set("vidaUtil")}
            required
          />
        </Campo>
        {comSituacao && (
          <Campo label="Situação">
            <Seletor
              opcoes={Object.entries(SITUACOES).map(([valor, rotulo]) => ({ valor, rotulo }))}
              value={f.situacao}
              onChange={set("situacao")}
            />
          </Campo>
        )}
      </div>
      <Button type="submit" className="rounded-full" disabled={gravando}>
        {gravando ? "Gravando…" : rotulo}
      </Button>
    </form>
  );
}
