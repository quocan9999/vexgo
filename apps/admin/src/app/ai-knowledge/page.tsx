import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { AiKnowledgeManagement } from '@/features/ai-knowledge/components/ai-knowledge-management';

export const metadata = {
  title: 'Quản lý Tri thức AI (RAG) | VexGo Admin',
};

export default function AiKnowledgePage() {
  return (
    <AdminSessionGuard>
      <AiKnowledgeManagement />
    </AdminSessionGuard>
  );
}
