import {
  type BotDocumentResponseDto,
  type BotDocumentRevisionResponseDto,
  type BotGroupResponseDto,
  type BotMemoryFactResponseDto,
  type BotResponseDto,
  heyApiSdk,
} from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import type { BotDocumentName } from '@oppenheimer/shared/schemas/bot';
import { injectable } from 'inversify';
import {
  BotDocumentEntity,
  BotDocumentRevisionEntity,
  BotEntity,
  BotGroupEntity,
  BotMemoryFactEntity,
  type SaveBotDocumentInput,
  type UpdateBotInput,
} from './bot.entity';
import { BotsErrors } from './bots.errors';

function toBot(dto: BotResponseDto): BotEntity {
  return new BotEntity(
    dto.id,
    dto.name,
    dto.description,
    dto.avatarColor,
    dto.groupId,
    dto.position,
    dto.homeHostId,
    dto.model,
    dto.effort,
    dto.permission,
    dto.learnAutomatically,
    new Date(dto.createdAt),
    new Date(dto.updatedAt),
    new Date(dto.lastActivityAt),
  );
}

function toGroup(dto: BotGroupResponseDto): BotGroupEntity {
  return new BotGroupEntity(dto.id, dto.name, dto.position, new Date(dto.createdAt));
}

function toDocument(dto: BotDocumentResponseDto): BotDocumentEntity {
  return new BotDocumentEntity(
    dto.name,
    dto.content,
    dto.revision,
    dto.updatedBy,
    new Date(dto.updatedAt),
  );
}

function toRevision(dto: BotDocumentRevisionResponseDto): BotDocumentRevisionEntity {
  return new BotDocumentRevisionEntity(
    dto.id,
    dto.name,
    dto.revision,
    dto.content,
    dto.author,
    dto.note,
    dto.revertedFrom,
    new Date(dto.createdAt),
  );
}

function toFact(dto: BotMemoryFactResponseDto): BotMemoryFactEntity {
  return new BotMemoryFactEntity(
    dto.id,
    dto.content,
    dto.source,
    new Date(dto.createdAt),
    new Date(dto.updatedAt),
  );
}

/**
 * The workspace's bots, their sidebar groups, their two documents and what
 * they remember (`product/versions/mvp/25-bots.md`, slice 1). Every call is
 * the API's; nothing here holds a rule of its own, so there is no service.
 */
@injectable()
export class BotsRepository {
  @MapApiError(BotsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<BotEntity[]> {
    const data = await unwrapBody(heyApiSdk.findBots(), BotsErrors.FETCH_LIST_FAILED);
    return data.map(toBot);
  }

  @MapApiError(BotsErrors.FETCH_FAILED)
  async findById(id: string): Promise<BotEntity> {
    const data = await unwrapBody(heyApiSdk.findBot({ path: { id } }), BotsErrors.FETCH_FAILED);
    return toBot(data);
  }

  /** A blank bot: "New Bot" (numbered when the workspace has one), ungrouped. */
  @MapApiError(BotsErrors.SAVE_FAILED)
  async create(): Promise<BotEntity> {
    const data = await unwrapBody(heyApiSdk.createBot({ body: {} }), BotsErrors.SAVE_FAILED);
    return toBot(data);
  }

  @MapApiError(BotsErrors.SAVE_FAILED)
  async update(id: string, input: UpdateBotInput): Promise<BotEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateBot({ path: { id }, body: input }),
      BotsErrors.SAVE_FAILED,
    );
    return toBot(data);
  }

  @MapApiError(BotsErrors.DELETE_FAILED)
  async remove(id: string): Promise<void> {
    await unwrap(heyApiSdk.deleteBot({ path: { id } }), BotsErrors.DELETE_FAILED);
  }

  @MapApiError(BotsErrors.FETCH_GROUPS_FAILED)
  async findGroups(): Promise<BotGroupEntity[]> {
    const data = await unwrapBody(heyApiSdk.findBotGroups(), BotsErrors.FETCH_GROUPS_FAILED);
    return data.map(toGroup);
  }

  @MapApiError(BotsErrors.SAVE_GROUP_FAILED)
  async createGroup(name: string): Promise<BotGroupEntity> {
    const data = await unwrapBody(
      heyApiSdk.createBotGroup({ body: { name } }),
      BotsErrors.SAVE_GROUP_FAILED,
    );
    return toGroup(data);
  }

  @MapApiError(BotsErrors.SAVE_GROUP_FAILED)
  async renameGroup(id: string, name: string): Promise<BotGroupEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateBotGroup({ path: { id }, body: { name } }),
      BotsErrors.SAVE_GROUP_FAILED,
    );
    return toGroup(data);
  }

  /** Its bots stay, ungrouped. */
  @MapApiError(BotsErrors.DELETE_GROUP_FAILED)
  async removeGroup(id: string): Promise<void> {
    await unwrap(heyApiSdk.deleteBotGroup({ path: { id } }), BotsErrors.DELETE_GROUP_FAILED);
  }

  /** Both documents, soul first. */
  @MapApiError(BotsErrors.FETCH_DOCUMENTS_FAILED)
  async findDocuments(id: string): Promise<BotDocumentEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findBotDocuments({ path: { id } }),
      BotsErrors.FETCH_DOCUMENTS_FAILED,
    );
    return data.map(toDocument);
  }

  /**
   * A new revision over `baseRevision`. A save over a newer one is refused
   * with `BOTS_006`, carrying the revision it is at
   * ({@link documentConflictRevision}).
   */
  @MapApiError(BotsErrors.SAVE_DOCUMENT_FAILED)
  async saveDocument(
    id: string,
    name: BotDocumentName,
    input: SaveBotDocumentInput,
  ): Promise<BotDocumentEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateBotDocument({ path: { id, name }, body: input }),
      BotsErrors.SAVE_DOCUMENT_FAILED,
    );
    return toDocument(data);
  }

  /** Newest first. */
  @MapApiError(BotsErrors.FETCH_REVISIONS_FAILED)
  async findRevisions(id: string, name: BotDocumentName): Promise<BotDocumentRevisionEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findBotDocumentRevisions({ path: { id, name } }),
      BotsErrors.FETCH_REVISIONS_FAILED,
    );
    return data.map(toRevision);
  }

  /** Writes that revision's content as the next revision; nothing in the history is lost. */
  @MapApiError(BotsErrors.REVERT_FAILED)
  async revert(id: string, name: BotDocumentName, revision: number): Promise<BotDocumentEntity> {
    const data = await unwrapBody(
      heyApiSdk.revertBotDocument({ path: { id, name, revision } }),
      BotsErrors.REVERT_FAILED,
    );
    return toDocument(data);
  }

  @MapApiError(BotsErrors.FETCH_MEMORY_FAILED)
  async findMemory(id: string): Promise<BotMemoryFactEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findBotMemory({ path: { id } }),
      BotsErrors.FETCH_MEMORY_FAILED,
    );
    return data.map(toFact);
  }

  @MapApiError(BotsErrors.SAVE_FACT_FAILED)
  async addFact(id: string, content: string): Promise<BotMemoryFactEntity> {
    const data = await unwrapBody(
      heyApiSdk.createBotMemoryFact({ path: { id }, body: { content } }),
      BotsErrors.SAVE_FACT_FAILED,
    );
    return toFact(data);
  }

  @MapApiError(BotsErrors.SAVE_FACT_FAILED)
  async updateFact(id: string, factId: string, content: string): Promise<BotMemoryFactEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateBotMemoryFact({ path: { id, factId }, body: { content } }),
      BotsErrors.SAVE_FACT_FAILED,
    );
    return toFact(data);
  }

  @MapApiError(BotsErrors.DELETE_FACT_FAILED)
  async removeFact(id: string, factId: string): Promise<void> {
    await unwrap(
      heyApiSdk.deleteBotMemoryFact({ path: { id, factId } }),
      BotsErrors.DELETE_FACT_FAILED,
    );
  }

  @MapApiError(BotsErrors.CLEAR_MEMORY_FAILED)
  async clearMemory(id: string): Promise<void> {
    await unwrap(heyApiSdk.clearBotMemory({ path: { id } }), BotsErrors.CLEAR_MEMORY_FAILED);
  }
}
