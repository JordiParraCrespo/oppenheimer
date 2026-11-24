export const WHATSAPP_GROUP_GRANT_REPOSITORY = Symbol('WHATSAPP_GROUP_GRANT_REPOSITORY');

export interface WhatsappGroupGrant {
  accountId: string;
  groupJid: string;
  botId: string;
}

export interface WhatsappGroupGrantRepositoryPort {
  countForAccount(accountId: string): Promise<number>;
  insert(grant: WhatsappGroupGrant): Promise<void>;
}
