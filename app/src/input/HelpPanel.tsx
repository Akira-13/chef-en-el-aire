// Ayuda contextual: ante "ayuda" muestra y lee los comandos y gestos que valen ahora (RF-14,
// CA-12.3). Se cierra con el botón o con cualquier otro comando.

import { useEffect, useState } from 'react';
import { useCommands } from '../core/commandBus';
import { getCommandContext, useCommandContext } from '../core/commandContext';
import { output, profileService } from '../core/services';
import { helpFor, helpSpeech, type HelpContent } from './help';
import styles from './input.module.css';

export function HelpPanel() {
  const [content, setContent] = useState<HelpContent | null>(null);
  const screen = useCommandContext((s) => s.screen);

  useCommands(({ command }) => {
    if (command.type !== 'help') {
      if (content) setContent(null);
      return;
    }
    const help = helpFor(getCommandContext(), profileService.getProfile().accessibility);
    setContent(help);
    output.announce({ ...helpSpeech(help), kind: 'info' });
  });

  useEffect(() => setContent(null), [screen]);

  if (!content) return null;

  return (
    <section className={styles.help} aria-labelledby="help-title">
      <h2 id="help-title" className={styles.helpTitle}>
        Lo que puedes hacer aquí
      </h2>
      {content.voice.length > 0 && (
        <>
          <h3 className={styles.helpHeading}>🎙️ Di «chef» y luego…</h3>
          <ul className={styles.helpVoice}>
            {content.voice.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </>
      )}
      {content.gestures.length > 0 && (
        <>
          <h3 className={styles.helpHeading}>Gestos</h3>
          {content.gestureNote && <p className={styles.helpNote}>{content.gestureNote}</p>}
          <ul className={styles.helpGestures}>
            {content.gestures.map((g) => (
              <li key={`${g.icon}-${g.does}`}>
                <span className={styles.helpIcon} aria-hidden="true">
                  {g.icon}
                </span>
                <span>
                  <strong>{g.does}</strong>: {g.how}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {content.touch && <p className={styles.helpNote}>También puedes tocar los botones.</p>}
      <button type="button" className={styles.helpClose} onClick={() => setContent(null)}>
        Cerrar ayuda
      </button>
    </section>
  );
}
