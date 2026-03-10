export type DebugLogEntry = {
  id: string;
  timestamp: string;
  scope: "content" | "background";
  message: string;
  data?: unknown;
};

const DEBUG_LOG_KEY = "miningExtDebugLog";
const MAX_DEBUG_LOG_ENTRIES = 200;

export async function appendDebugLog(
  scope: DebugLogEntry["scope"],
  message: string,
  data?: unknown,
): Promise<void> {
  const entry: DebugLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    scope,
    message,
    data,
  };

  console.log(`[mining-ext:${scope}] ${message}`, data);

  const result = await chrome.storage.local.get(DEBUG_LOG_KEY);
  const current = (result[DEBUG_LOG_KEY] as DebugLogEntry[] | undefined) ?? [];
  const next = [...current, entry].slice(-MAX_DEBUG_LOG_ENTRIES);
  await chrome.storage.local.set({
    [DEBUG_LOG_KEY]: next,
  });
}

export async function loadDebugLog(): Promise<DebugLogEntry[]> {
  const result = await chrome.storage.local.get(DEBUG_LOG_KEY);
  return (result[DEBUG_LOG_KEY] as DebugLogEntry[] | undefined) ?? [];
}

export async function clearDebugLog(): Promise<void> {
  await chrome.storage.local.set({
    [DEBUG_LOG_KEY]: [],
  });
}
