import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AuthGate, AuthSessionProvider } from "@/features/auth";

export default function AppLayout({ children }) {
  return (
    <AuthSessionProvider>
      <AuthGate>
        <DashboardLayout>{children}</DashboardLayout>
      </AuthGate>
    </AuthSessionProvider>
  );
}
