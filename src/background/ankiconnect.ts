type AnkiResponse<T> = {
  result: T;
  error: string | null;
};

type NoteInfo = {
  noteId: number;
};

export class AnkiConnectClient {
  constructor(private readonly baseUrl: string) {}

  async version(): Promise<number> {
    return this.invoke<number>('version');
  }

  async storeMediaFile(filename: string, data: string): Promise<string | null> {
    return this.invoke<string | null>('storeMediaFile', {filename, data});
  }

  async findNotes(query: string): Promise<number[]> {
    return this.invoke<number[]>('findNotes', {query});
  }

  async notesInfo(notes: number[]): Promise<NoteInfo[]> {
    return this.invoke<NoteInfo[]>('notesInfo', {notes});
  }

  async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<null> {
    return this.invoke<null>('updateNoteFields', {
      note: {
        id: noteId,
        fields
      }
    });
  }

  private async invoke<T>(action: string, params?: unknown): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action,
        version: 6,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`AnkiConnect request failed (${response.status})`);
    }

    const json = (await response.json()) as AnkiResponse<T>;
    if (json.error) {
      throw new Error(json.error);
    }

    return json.result;
  }
}
