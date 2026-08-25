import DashboardSkeleton from '@/app/dashboard/components/DashboardSkeleton';

export default function Loading() {
  return (
    <div className="skeleton-page">
      <DashboardSkeleton variant="overview" />
    </div>
  );
}
