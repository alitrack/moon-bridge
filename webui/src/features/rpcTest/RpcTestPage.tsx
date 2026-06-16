import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { MaterialFilledButton } from "../../components/MaterialButton";
import { MaterialSelect } from "../../components/MaterialSelect";
import { MaterialOutlinedTextField } from "../../components/MaterialTextField";
import {
  createResponse,
  listResponseModels,
  type CreateResponseResult
} from "../../rpc/responses";
import { useI18n } from "../../i18n/I18nProvider";
import { PageHeader, QueryErrorState } from "../shared";

export function RpcTestPage() {
  const { t } = useI18n();
  const models = useQuery({
    queryKey: ["responses", "models"],
    queryFn: listResponseModels
  });
  const [model, setModel] = useState("");
  const [input, setInput] = useState("ping");
  const [maxTokens, setMaxTokens] = useState("256");
  const [temperature, setTemperature] = useState("0.2");
  const [latency, setLatency] = useState<number | null>(null);
  const [result, setResult] = useState<CreateResponseResult | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (models.error) {
    return <QueryErrorState error={models.error} />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const started = performance.now();
    try {
      const response = await createResponse({
        model: model || models.data?.models[0]?.slug || "",
        input,
        max_output_tokens: Number(maxTokens),
        temperature: Number(temperature)
      });
      setLatency(Math.round(performance.now() - started));
      setResult(response);
    } catch (caught) {
      setLatency(Math.round(performance.now() - started));
      setError(caught);
    }
  }

  return (
    <section className="page-stack" aria-labelledby="rpc-test-title">
      <PageHeader eyebrow={t("pageEyebrow.smokeTest")} title={t("nav.rpcTest")}>
        {t("rpc.description")}
      </PageHeader>
      <style>{rpcTestStyles}</style>
      <div className="section-grid">
        <section className="content-panel">
          <h2>{t("rpc.request")}</h2>
          <form className="form-grid" onSubmit={submit}>
            <MaterialSelect
              className="rpc-test-field form-grid__wide"
              label={t("field.model")}
              value={model}
              onChange={setModel}
              options={[
                { label: t("rpc.selectModel"), value: "" },
                ...(models.data?.models.map((item) => ({ label: item.slug, value: item.slug })) ?? [])
              ]}
            />
            <MaterialOutlinedTextField
              className="rpc-test-field form-grid__wide"
              label={t("field.input")}
              rows={6}
              type="textarea"
              value={input}
              onInput={setInput}
            />
            <MaterialOutlinedTextField
              className="rpc-test-field"
              label={t("field.maxOutputTokens")}
              type="number"
              value={maxTokens}
              onInput={setMaxTokens}
            />
            <MaterialOutlinedTextField
              className="rpc-test-field"
              label={t("field.temperature")}
              step="0.1"
              type="number"
              value={temperature}
              onInput={setTemperature}
            />
            <div className="form-actions">
              <MaterialFilledButton type="submit">{t("action.send")}</MaterialFilledButton>
            </div>
          </form>
        </section>
        <section className="content-panel">
          <h2>{t("rpc.response")}</h2>
          {latency !== null ? <p className="feedback-inline">{t("feedback.latency", { latency })}</p> : null}
          {error ? (
            <pre className="json-block">{JSON.stringify(error, null, 2)}</pre>
          ) : (
            <pre className="json-block">{JSON.stringify(result ?? {}, null, 2)}</pre>
          )}
        </section>
      </div>
    </section>
  );
}

const rpcTestStyles = `
  .rpc-test-field {
    width: 100%;
    min-width: 0;
  }
`;
