import type { ExampleCandidate, MiningPayload, SearchContext } from "./types";

type SearchResponse = {
  examples: ExampleCandidate[];
};

const TITLE_OVERRIDES: Record<string, string> = {
  steins_gate: "Steins Gate",
  durarara__: "Durarara!!",
  re_zero___starting_life_in_another_world:
    "Re Zero - Starting Life in Another World",
  k_on_: "K On!",
  boku_no_hero_academia_season_1: "Boku no Hero Academia Season 1",
  fate_stay_night_unlimited_blade_works:
    "Fate Stay Night Unlimited Blade Works",
  is_the_order_a_rabbit: "Is the Order a Rabbit",
  god_s_blessing_on_this_wonderful_world_:
    "God s Blessing on this Wonderful World",
  alya_sometimes_hides_her_feelings_in_russian:
    "Alya Sometimes Hides Her Feelings in Russian",
  frieren_beyond_journey_s_end: "Frieren Beyond Journey s End",
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function searchExamples(
  search: SearchContext,
): Promise<ExampleCandidate[]> {
  const params = new URLSearchParams({
    q: search.keyword,
  });

  if (search.exactMatch) {
    params.set("exactMatch", "true");
  }
  if (search.sort) {
    params.set("sort", search.sort);
  }
  if (search.jlpt) {
    params.set("jlpt", search.jlpt);
  }
  if (search.wk) {
    params.set("wk", search.wk);
  }
  if (search.category && search.category !== "all") {
    params.set("category", search.category);
  }
  if (search.index) {
    params.set("index", search.index);
  }

  const response = await fetch(
    `https://apiv2.immersionkit.com/search?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`ImmersionKit search failed (${response.status})`);
  }

  const json = (await response.json()) as SearchResponse;
  return json.examples;
}

export function findMatchingExample(
  examples: ExampleCandidate[],
  payload: Pick<MiningPayload, "sentence" | "translation" | "title">,
): ExampleCandidate | null {
  const ranked = examples
    .map((example) => ({
      example,
      score: scoreExampleMatch(example, payload),
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best || best.score < 100) {
    return null;
  }

  return best.example;
}

function slugToTitlePath(slug: string): string {
  if (TITLE_OVERRIDES[slug]) {
    return TITLE_OVERRIDES[slug];
  }

  return slug
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildMediaPath(
  id: string,
  fileName: string,
  titleSlug: string,
): string {
  const mediaType = id.split("_")[0];
  const titlePath = slugToTitlePath(titleSlug);
  return `media/${mediaType}/${titlePath}/media/${fileName}`;
}

export function buildImageUrl(example: ExampleCandidate): string | null {
  if (!example.image) {
    return null;
  }

  const path = buildMediaPath(example.id, example.image, example.title);
  return `https://apiv2.immersionkit.com/download_media?path=${encodeURIComponent(path)}`;
}

export function buildAudioUrl(example: ExampleCandidate): string | null {
  if (!example.sound) {
    return null;
  }

  const path = buildMediaPath(example.id, example.sound, example.title);
  return `https://apiv2.immersionkit.com/download_media?path=${encodeURIComponent(path)}`;
}

function scoreExampleMatch(
  example: ExampleCandidate,
  payload: Pick<MiningPayload, "sentence" | "translation" | "title">,
): number {
  const sentence = normalizeText(payload.sentence);
  const translation = normalizeText(payload.translation ?? "");
  const title = normalizeText(payload.title ?? "");

  const exampleSentence = normalizeText(example.sentence);
  const exampleSentenceWithFurigana = normalizeText(
    example.sentence_with_furigana,
  );
  const exampleTranslation = normalizeText(example.translation);
  const exampleTitle = normalizeText(slugToTitlePath(example.title));
  const exampleSlug = normalizeText(example.title.replaceAll("_", " "));

  let score = 0;

  if (sentence.length > 0) {
    if (exampleSentence === sentence) {
      score += 160;
    } else if (exampleSentenceWithFurigana === sentence) {
      score += 150;
    } else if (
      exampleSentence.includes(sentence) ||
      sentence.includes(exampleSentence)
    ) {
      score += 80;
    }
  }

  if (translation.length > 0) {
    if (exampleTranslation === translation) {
      score += 60;
    } else if (
      exampleTranslation.includes(translation) ||
      translation.includes(exampleTranslation)
    ) {
      score += 25;
    }
  }

  if (title.length > 0) {
    if (exampleTitle === title || exampleSlug === title) {
      score += 35;
    } else if (exampleTitle.includes(title) || title.includes(exampleTitle)) {
      score += 15;
    }
  }

  return score;
}
