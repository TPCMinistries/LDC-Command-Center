import { AgentsHub } from '@/components/agents/AgentsHub'

interface AgentsPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function AgentsPage({ params }: AgentsPageProps) {
  const { workspaceId } = await params

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">AI Agents</h1>
        <p className="text-zinc-400 mt-1">
          Your team of AI assistants to help manage work, create content, and make decisions
        </p>
      </div>

      <AgentsHub workspaceId={workspaceId} />
    </div>
  )
}
