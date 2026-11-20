import { useAppContext } from '../context/AppContext';
import { ArchiveList } from '../components/archive/ArchiveList';
import { ArchivedProject } from '../components/archive/ArchivedProject';
import { ArchivedOwnJar } from '../components/archive/ArchivedOwnJar';

/** «Архів» in the header: closed projects and the user's own jars, by year, all read-only. */
export function ArchivePage() {
  const { state } = useAppContext();
  const view = state.app.archiveView;
  if (view?.kind === 'project') return <ArchivedProject key={view.id} id={view.id} />;
  if (view?.kind === 'ownJar') return <ArchivedOwnJar key={view.id} id={view.id} />;
  return <ArchiveList />;
}
