export const WHATSAPP_GROUP_GRANT_REPOSITORY = Symbol('WHATSAPP_GROUP_GRANT_REPOSITORY');

export interface WhatsappGroupGrant {
  accountId: string;
  groupJid: string;
  botId: string;
}

export interface WhatsappGroupGrantRepositoryPort {
  /**
   * Inserts the grant only while the account holds fewer than `cap`, in one
   * statement, so two allows at once cannot both pass the cap. Answers
   * whether it inserted.
   */
  insertUnderCap(grant: WhatsappGroupGrant, cap: number): Promise<boolean>;
}
