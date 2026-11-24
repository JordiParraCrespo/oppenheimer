export class AllowWhatsappGroupCommand {
  constructor(
    readonly accountId: string,
    readonly groupJid: string,
    readonly botId: string,
  ) {}
}
