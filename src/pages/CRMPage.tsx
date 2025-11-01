import { AppLayout } from "@/components/layout/AppLayout";
import CRMDashboard from "@/components/CRM/CRMDashboard";

export default function CRMPage() {
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <CRMDashboard />
      </div>
    </AppLayout>
  );
}
