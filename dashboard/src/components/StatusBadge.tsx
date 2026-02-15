const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-700',
  pending: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
  skipped: 'bg-yellow-100 text-yellow-700',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusStyles[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {status === 'running' && (
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse-dot" />
      )}
      {status}
    </span>
  );
}
