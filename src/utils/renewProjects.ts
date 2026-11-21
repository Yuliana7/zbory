// «Оновити все» for the main jars: each linked project's own statement, read from the day of its newest
// row and merged in. Not through client-info, which stops listing a main jar once it is closed — the
// statement still answers for it. Monobank allows one statement a minute, so this takes a while.

import type { CampaignMeta } from './campaignStore';
import { loadCampaignData, saveCampaign } from './campaignStore';
import { mergeRawDonations } from './mergeDonations';
import {
  MonobankError,
  dayStartSec,
  fetchJarStatement,
  statementItemsToRawDonations,
  updateRangeStart,
  type FetchProgress,
  type MonobankDeps,
  type MonobankErrorKind,
} from './monobankApi';
import { isArchived } from './archive';

/** The projects «Оновити все» reads: active ones linked to a Monobank jar. */
export const renewableProjects = (campaigns: CampaignMeta[]) => campaigns.filter((c) => c.monobankJar && !isArchived(c));

export interface ProjectsRenewProgress {
  index: number;
  total: number;
  name: string;
  fetch: FetchProgress | null;
}

export interface ProjectsRenewResult {
  /** projects with new donations, and how many */
  updated: Array<{ name: string; added: number }>;
  /** read, nothing new */
  unchanged: string[];
  failed: Array<{ name: string; kind: MonobankErrorKind }>;
  /** the token was refused: everything after it was left */
  tokenRefused: boolean;
}

export async function renewProjects(
  campaigns: CampaignMeta[],
  token: string,
  opts: { signal?: AbortSignal; onProgress?: (p: ProjectsRenewProgress) => void; deps?: MonobankDeps; now?: () => number } = {},
): Promise<ProjectsRenewResult> {
  const now = opts.now ?? Date.now;
  const list = renewableProjects(campaigns);
  const out: ProjectsRenewResult = { updated: [], unchanged: [], failed: [], tokenRefused: false };
  for (const [index, meta] of list.entries()) {
    if (opts.signal?.aborted) break;
    opts.onProgress?.({ index, total: list.length, name: meta.name, fetch: null });
    const data = await loadCampaignData(meta.id);
    const from = data && updateRangeStart(data.rawData);
    if (!data || !from) {
      out.failed.push({ name: meta.name, kind: 'unexpected' });
      continue;
    }
    try {
      const items = await fetchJarStatement({
        token,
        jarId: meta.monobankJar!.id,
        fromSec: dayStartSec(from),
        toSec: Math.floor(now() / 1000),
        signal: opts.signal,
        deps: opts.deps,
        onProgress: (fetch) => opts.onProgress?.({ index, total: list.length, name: meta.name, fetch }),
      });
      const { merged, added } = mergeRawDonations(data.rawData, statementItemsToRawDonations(items));
      // the rows (if any are new) and the time of the read; name, goal, friends, raffles and style stay
      await saveCampaign({ id: meta.id, name: meta.name, rawData: added > 0 ? merged : data.rawData, fileName: meta.fileName, goal: meta.goal, monobankSyncedAt: now() });
      if (added > 0) out.updated.push({ name: meta.name, added });
      else out.unchanged.push(meta.name);
    } catch (err) {
      if (opts.signal?.aborted) break;
      const kind = err instanceof MonobankError ? err.kind : 'unexpected';
      if (kind === 'invalid-token') {
        out.tokenRefused = true;
        break;
      }
      out.failed.push({ name: meta.name, kind });
    }
  }
  return out;
}
