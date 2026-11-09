import type { HostFolderSearch } from './application/host-folders.port';
import { HostFolderSearchResponseDto } from './dtos/host-folder-search.response.dto';

/** The folder picker's search, as the console reads it. */
export class HostFolderSearchMapper {
  /** The runner's answer, absent branches and `truncated` spelled out as for a listing. */
  static toResponse(search: HostFolderSearch): HostFolderSearchResponseDto {
    const dto = new HostFolderSearchResponseDto();
    dto.path = search.path;
    dto.home = search.home;
    dto.entries = search.entries.map((entry) => ({
      path: entry.path,
      branch: entry.branch ?? null,
    }));
    dto.truncated = search.truncated ?? false;
    return dto;
  }
}
