export const WHATSAPP_GROUP_GRANT_REPOSITORY = Symbol('WHATSAPP_GROUP_GRANT_REPOSITORY');

export interface WhatsappGroupGrant {
  accountId: string;
  groupJid: string;
  botId: string;
}

export interface WhatsappGroupGrantRepositoryPort {
  /**
   * Inserts the grant only while the account holds fewer than `cap`, in one
   * statement, so two allows at once cannot both pass the cap. A group
   * already granted is re-pointed at the new bot and takes no new slot.
   * Answers whether it wrote.
   */
  insertUnderCap(grant: WhatsappGroupGrant, cap: number): Promise<boolean>;
}
