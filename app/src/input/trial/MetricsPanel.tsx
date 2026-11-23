// Resumen de métricas contra los umbrales de los RNF (?prueba=metricas, CA-37.1). Lo usa el
// facilitador al terminar una sesión para ver y exportar los resultados del teléfono.

import { useState } from 'react';
import {
  exportSummaryJson,
  formatMetricValue,
  formatSummaryMarkdown,
  summarizeMetrics,
  thresholdLabel,
  type MetricStatus,
} from '../../core/metricsReport';
import { metrics } from '../../core/metrics';
import { Button } from '../../ui';
import { downloadFile } from './download';
import styles from './trial.module.css';
import { sanitizeParticipant } from './voiceTrial';

const STATUS_MARK: Record<MetricStatus, string> = {
  Cumple: '✔ Cumple',
  'No cumple': '✘ No cumple',
  'Sin datos': '— Sin datos',
};

export function MetricsPanel() {
  const [samples, setSamples] = useState(() => [...metrics.samples()]);
  const [participant, setParticipant] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);

  const rows = summarizeMetrics(samples);
  const code = sanitizeParticipant(participant);
  const prefix = code ?? 'resumen';

  function exportJson(): void {
    downloadFile(`${prefix}-resumen-metricas.json`, exportSummaryJson(rows, new Date()));
  }

  function exportMarkdown(): void {
    downloadFile(`${prefix}-resumen-metricas.md`, formatSummaryMarkdown(rows), 'text/markdown');
  }

  return (
    <section className={styles.panel} aria-labelledby="metrics-title">
      <h2 id="metrics-title" className={styles.title}>
        Métricas contra los umbrales · {samples.length} muestras
      </h2>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Resumen de métricas por requerimiento</caption>
          <thead>
            <tr>
              <th scope="col">Métrica</th>
              <th scope="col">n</th>
              <th scope="col">Valor</th>
              <th scope="col">Umbral</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">
                  {row.name}
                  <br />
                  <span className={styles.note}>{row.rnf}</span>
                </th>
                <td>{row.n}</td>
                <td>
                  {row.compared} = {formatMetricValue(row.value)}
                </td>
                <td>{thresholdLabel(row)}</td>
                <td>{STATUS_MARK[row.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className={styles.field}>
        Código del participante (P01 a P08, sin nombres)
        <input
          className={styles.input}
          value={participant}
          maxLength={3}
          placeholder="P01"
          autoComplete="off"
          onChange={(event) => setParticipant(event.target.value)}
        />
      </label>

      <div className={styles.row}>
        <Button onClick={exportJson}>Exportar resumen (JSON)</Button>
        <Button variant="secondary" onClick={exportMarkdown}>
          Exportar resumen (Markdown)
        </Button>
        <Button variant="secondary" onClick={() => setSamples([...metrics.samples()])}>
          Actualizar
        </Button>
      </div>

      {confirmingClear ? (
        <div className={styles.row} role="group" aria-label="Confirmar borrado">
          <p className={styles.note}>
            ¿Borrar todas las muestras de este teléfono? Exporta antes si las necesitas.
          </p>
          <Button
            onClick={() => {
              metrics.clear();
              setSamples([]);
              setConfirmingClear(false);
            }}
          >
            Sí, borrar
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingClear(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirmingClear(true)}>
          Borrar muestras
        </Button>
      )}
      <p className={styles.note}>
        Las respuestas del asistente se comparan con el umbral remoto (8 s) mientras no registren su
        proveedor. Las muestras son solo tiempos: no incluyen audio, video ni texto.
      </p>
    </section>
  );
}
