import {useEffect, useState} from 'react';

import {defaultSettings} from '../shared/settings';
import type {ExtensionSettings, RuntimeMessage} from '../shared/types';
import type {DebugLogEntry} from '../shared/debug';

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    void chrome.runtime
      .sendMessage({type: 'get-settings'} satisfies RuntimeMessage)
      .then((result: ExtensionSettings) => {
        setSettings(result);
        setStatus('');
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Failed to load settings');
      });

    void loadDebugLog();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Saving...');

    await chrome.runtime.sendMessage({
      type: 'save-settings',
      payload: settings
    } satisfies RuntimeMessage);

    setStatus('Saved');
    window.setTimeout(() => setStatus(''), 1500);
  }

  async function loadDebugLog() {
    const result = (await chrome.runtime.sendMessage({
      type: 'get-debug-log'
    } satisfies RuntimeMessage)) as DebugLogEntry[];
    setDebugLog(result);
  }

  async function handleClearLog() {
    await chrome.runtime.sendMessage({
      type: 'clear-debug-log'
    } satisfies RuntimeMessage);
    setDebugLog([]);
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Immersion Kit Mining Helper</h1>
        <p style={styles.subtitle}>
          Configure which Anki note fields receive the sentence, image, and audio.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            AnkiConnect URL
            <input
              style={styles.input}
              value={settings.ankiConnectUrl}
              onChange={(event) =>
                setSettings((current) => ({...current, ankiConnectUrl: event.target.value}))
              }
            />
          </label>

          <label style={styles.label}>
            Sentence field
            <input
              style={styles.input}
              value={settings.sentenceField}
              onChange={(event) =>
                setSettings((current) => ({...current, sentenceField: event.target.value}))
              }
            />
          </label>

          <label style={styles.label}>
            Image field
            <input
              style={styles.input}
              value={settings.imageField}
              onChange={(event) =>
                setSettings((current) => ({...current, imageField: event.target.value}))
              }
            />
          </label>

          <label style={styles.label}>
            Audio field
            <input
              style={styles.input}
              value={settings.audioField}
              onChange={(event) =>
                setSettings((current) => ({...current, audioField: event.target.value}))
              }
            />
          </label>

          <label style={styles.label}>
            Latest note query
            <input
              style={styles.input}
              value={settings.latestNoteQuery}
              onChange={(event) =>
                setSettings((current) => ({...current, latestNoteQuery: event.target.value}))
              }
            />
          </label>

          <button type="submit" style={styles.button}>
            Save settings
          </button>
        </form>

        {status ? <p style={styles.status}>{status}</p> : null}

        <section style={styles.logSection}>
          <div style={styles.logHeader}>
            <h2 style={styles.logTitle}>Debug log</h2>
            <div style={styles.logActions}>
              <button type="button" style={styles.secondaryButton} onClick={() => void loadDebugLog()}>
                Refresh log
              </button>
              <button type="button" style={styles.secondaryButton} onClick={() => void handleClearLog()}>
                Clear log
              </button>
            </div>
          </div>

          <div style={styles.logList}>
            {debugLog.length === 0 ? (
              <p style={styles.logEmpty}>No debug entries yet.</p>
            ) : (
              debugLog
                .slice()
                .reverse()
                .map((entry) => (
                  <pre key={entry.id} style={styles.logEntry}>
                    {`${entry.timestamp} [${entry.scope}] ${entry.message}\n${entry.data ? JSON.stringify(entry.data, null, 2) : ''}`}
                  </pre>
                ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    padding: '32px',
    background:
      'linear-gradient(180deg, rgb(243 247 252) 0%, rgb(230 238 247) 100%)',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
  },
  card: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '28px',
    borderRadius: '18px',
    background: '#ffffff',
    boxShadow: '0 18px 50px rgba(20, 44, 74, 0.12)'
  },
  title: {
    margin: '0 0 8px',
    fontSize: '28px'
  },
  subtitle: {
    margin: '0 0 20px',
    color: '#475467'
  },
  form: {
    display: 'grid',
    gap: '16px'
  },
  label: {
    display: 'grid',
    gap: '8px',
    fontWeight: 600
  },
  input: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #d0d5dd',
    fontSize: '14px'
  },
  button: {
    width: 'fit-content',
    padding: '10px 16px',
    border: 'none',
    borderRadius: '10px',
    background: '#0f6cbd',
    color: '#ffffff',
    fontWeight: 700,
    cursor: 'pointer'
  },
  secondaryButton: {
    width: 'fit-content',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #d0d5dd',
    background: '#ffffff',
    color: '#344054',
    fontWeight: 600,
    cursor: 'pointer'
  },
  status: {
    marginTop: '16px',
    color: '#344054'
  },
  logSection: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #eaecf0'
  },
  logHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px'
  },
  logTitle: {
    margin: 0,
    fontSize: '18px'
  },
  logActions: {
    display: 'flex',
    gap: '8px'
  },
  logList: {
    display: 'grid',
    gap: '8px',
    maxHeight: '420px',
    overflow: 'auto'
  },
  logEmpty: {
    margin: 0,
    color: '#667085'
  },
  logEntry: {
    margin: 0,
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#101828',
    color: '#f8fafc',
    fontSize: '12px',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }
};
