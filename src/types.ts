import type { Tables, TablesInsert, TablesUpdate } from "./db/database.types";

type DbCard = Tables<"cards">;
type DbDeck = Tables<"decks">;
type DbSource = Tables<"sources">;
type DbProfile = Tables<"profiles">;

// API-level enums derived from known business rules in the API plan.
export type CardQualityStatus = "draft" | "ok" | "good";
export type AccountRole = "demo" | "full";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export type DeckDto = Pick<DbDeck, "id" | "name" | "description" | "created_at">;

export type CardDto = Pick<
  DbCard,
  | "id"
  | "question"
  | "answer"
  | "context"
  | "difficulty"
  | "tags"
  | "quality_status"
  | "deck_id"
  | "source_id"
  | "created_at"
  | "updated_at"
>;

export interface ListDecksQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListDecksResponseDto {
  data: DeckDto[];
  meta: PaginationMeta;
}

export interface GetDeckResponseDto {
  data: DeckDto;
}

export type DeckCreateCommand = Pick<TablesInsert<"decks">, "name" | "description">;

export type DeckUpdateCommand = Pick<TablesUpdate<"decks">, "name" | "description">;

export interface ListCardsQuery {
  page?: number;
  limit?: number;
  deck_id?: DbDeck["id"];
  source_id?: DbSource["id"];
  quality_status?: CardQualityStatus;
  tags?: string[];
  sort?: "created_at_desc" | "created_at_asc";
}

export interface ListCardsResponseDto {
  data: CardDto[];
  meta: PaginationMeta;
}

export type CardCreateCommand = Pick<
  TablesInsert<"cards">,
  "question" | "answer" | "context" | "deck_id" | "tags" | "difficulty"
>;

// API accepts a single object or an array of objects.
export type CardsCreateCommand = CardCreateCommand | CardCreateCommand[];

export type CardUpdateCommand = Pick<
  TablesUpdate<"cards">,
  "question" | "answer" | "context" | "deck_id" | "tags" | "difficulty" | "quality_status"
>;

export interface BatchUpdateCardsCommand {
  card_ids: DbCard["id"][];
  action: "update_status" | "add_tags" | "delete";
  payload: {
    quality_status?: CardQualityStatus;
    tags?: DbCard["tags"];
  };
}

export interface GenerateCardsCommand {
  content: string;
  deck_id?: DbDeck["id"];
}

export interface GeneratedCardDto {
  id: DbCard["id"];
  // API uses front/back while database uses question/answer.
  front: DbCard["question"];
  back: DbCard["answer"];
  context: DbCard["context"];
  difficulty: DbCard["difficulty"];
  tags: DbCard["tags"];
  quality_status: CardQualityStatus;
}

export interface GenerateCardsResponseDto {
  source_id: DbSource["id"];
  cards: GeneratedCardDto[];
  remaining_generations: number;
}

export interface UserStatusDto {
  id: DbProfile["id"];
  role: AccountRole;
  limits: {
    cards_created: number;
    cards_limit: number;
    decks_created: number;
    decks_limit: number;
    daily_generations_used: number;
    daily_generations_limit: number;
  };
}

export interface ExportQueryCommand {
  deck_id?: DbDeck["id"];
  format: "json" | "csv";
}
