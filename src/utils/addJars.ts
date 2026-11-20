// «Додати банку» from Monobank: every jar in the user's client-info, main and friendly, with what the app
// already has of each. Main jars come in with their statement; friendly jars (no statement in the API)
// with their balance and goal, renewed through client-info from then on.

import type { OwnJar } from '../types';
import type { CampaignMeta } from './campaignStore';
import { isArchived } from './archive';
import { isFriendlyMonoJar, isUahJar, type MonoJar } from './monobankApi';
import { likelySameJar } from './ownJars';

export type JarKind = 'main' | 'friendly';

export interface JarChoice {
  jar: MonoJar;
  /** what the empty-sendId rule says; the user can switch it */
  kind: JarKind;
  /** the app has it already (as a project or a friendly jar), active or in the archive */
  added: 'active' | 'archive' | null;
  /** a friendly jar already tracked by link that is probably this one (same name and goal) */
  match: OwnJar | null;
  /** hryvnia jars only */
  usable: boolean;
}

/** The jars of the user's client-info as choices, main ones first. */
export function jarChoices(jars: MonoJar[], campaigns: CampaignMeta[], ownJars: OwnJar[]): JarChoice[] {
  return jars
    .map((jar) => {
      const project = campaigns.find((c) => c.monobankJar?.id === jar.id);
      const own = ownJars.find((j) => j.monoId === jar.id);
      const known = project ?? own;
      return {
        jar,
        kind: isFriendlyMonoJar(jar) ? ('friendly' as const) : ('main' as const),
        added: known ? (isArchived(known) ? ('archive' as const) : ('active' as const)) : null,
        match: own ? null : (ownJars.find((j) => !isArchived(j) && likelySameJar(j, jar)) ?? null),
        usable: isUahJar(jar),
      };
    })
    .sort((a, b) => Number(a.kind === 'friendly') - Number(b.kind === 'friendly'));
}
