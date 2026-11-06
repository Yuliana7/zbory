import { SpinnerIcon } from '../icons';

export function PageLoading() {
  return (
    <div className="py-20 flex justify-center text-indigo-500" role="status">
      <SpinnerIcon className="w-6 h-6 animate-spin" />
    </div>
  );
}
