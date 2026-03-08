import type { ExtensionSettings } from "./types";

export const defaultSettings: ExtensionSettings = {
  ankiConnectUrl: "http://127.0.0.1:8765/",
  sentenceField: "Sentence",
  imageField: "Image",
  audioField: "Sentence-Audio",
  latestNoteQuery: "added:1",
};

const STORAGE_KEY = "miningExtSettings";

export async function loadSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return {
    ...defaultSettings,
    ...(result[STORAGE_KEY] as Partial<ExtensionSettings> | undefined),
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: settings,
  });
}
