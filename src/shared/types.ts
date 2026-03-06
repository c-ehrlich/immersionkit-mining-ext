export type ExtensionSettings = {
  ankiConnectUrl: string;
  sentenceField: string;
  imageField: string;
  audioField: string;
  latestNoteQuery: string;
};

export type SearchContext = {
  keyword: string;
  exactMatch: boolean;
  sort?: string;
  jlpt?: string;
  wk?: string;
  category?: string;
  index?: string;
};

export type ExampleCandidate = {
  id: string;
  sentence: string;
  sentence_with_furigana: string;
  translation: string;
  image: string;
  sound: string;
  title: string;
};

export type MiningPayload = {
  sentence: string;
  search: SearchContext;
};

export type MiningResult =
  | {ok: true; noteId: number; updatedFields: string[]}
  | {ok: false; error: string};

export type RuntimeMessage =
  | {type: 'mine-example'; payload: MiningPayload}
  | {type: 'get-settings'}
  | {type: 'save-settings'; payload: ExtensionSettings};
