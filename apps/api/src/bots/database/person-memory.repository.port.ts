import type { PersonAbout } from '../domain/bot.types';

/** What a person wrote about themselves for their bots, one text per workspace. */
export interface PersonMemoryRepositoryPort {
  /** Theirs, or an empty text never saved when they wrote nothing. */
  find(organizationId: string, userId: string): Promise<PersonAbout>;
  /** Writes it over whatever was there, and answers it as saved. */
  put(organizationId: string, userId: string, about: string): Promise<PersonAbout>;
}
