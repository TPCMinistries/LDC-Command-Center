'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Folder,
  Calendar,
  CheckCircle2,
  Clock,
  Pause,
  Archive,
  MoreHorizontal,
  Trash2,
  Edit,
  Target,
  DollarSign,
  Users,
  ListTodo,
  TrendingUp,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { format, differenceInDays, isPast } from 'date-fns'

interface Project {
  id: string
  title: string
  description: string | null
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  priority: number
  owner_id: string | null
  team_member_ids: string[]
  start_date: string | null
  target_end_date: string | null
  actual_end_date: string | null
  category: string | null
  tags: string[]
  budget_amount: number | null
  budget_currency: string
  rfp_id: string | null
  rfp?: { id: string; title: string; status: string } | null
  taskStats: { total: number; completed: number }
  progress: number
  created_at: string
}

interface RFP {
  id: string
  title: string
  status: string
}

interface ProjectsClientProps {
  workspaceId: string
  initialProjects: Project[]
  rfps: RFP[]
}

const STATUS_CONFIG = {
  planning: { label: 'Planning', color: 'bg-blue-500/20 text-blue-400', icon: Clock },
  active: { label: 'Active', color: 'bg-green-500/20 text-green-400', icon: TrendingUp },
  on_hold: { label: 'On Hold', color: 'bg-amber-500/20 text-amber-400', icon: Pause },
  completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-zinc-500/20 text-zinc-400', icon: Archive },
}

const CATEGORY_OPTIONS = [
  'Grant Project',
  'Operations',
  'Program',
  'Marketing',
  'Development',
  'Research',
  'Ministry',
  'Other',
]

export function ProjectsClient({ workspaceId, initialProjects, rfps }: ProjectsClientProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    category: '',
    priority: 2,
    startDate: '',
    targetEndDate: '',
    budgetAmount: '',
    rfpId: '',
  })

  const filteredProjects = projects.filter(project => {
    if (statusFilter === 'active' && !['planning', 'active'].includes(project.status)) return false
    if (statusFilter !== 'active' && statusFilter !== 'all' && project.status !== statusFilter) return false
    if (categoryFilter !== 'all' && project.category !== categoryFilter) return false
    return true
  })

  const createProject = async () => {
    if (!newProject.title.trim()) return

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          project: {
            title: newProject.title,
            description: newProject.description || null,
            category: newProject.category || null,
            priority: newProject.priority,
            startDate: newProject.startDate || null,
            targetEndDate: newProject.targetEndDate || null,
            budgetAmount: newProject.budgetAmount ? parseFloat(newProject.budgetAmount) : null,
            rfpId: newProject.rfpId || null,
          },
        }),
      })

      const data = await res.json()
      if (data.success) {
        const projectWithStats = {
          ...data.project,
          taskStats: { total: 0, completed: 0 },
          progress: 0,
          rfp: newProject.rfpId ? rfps.find(r => r.id === newProject.rfpId) : null,
        }
        setProjects(prev => [projectWithStats, ...prev])
        setNewProject({
          title: '',
          description: '',
          category: '',
          priority: 2,
          startDate: '',
          targetEndDate: '',
          budgetAmount: '',
          rfpId: '',
        })
        setIsCreateOpen(false)
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const updateProject = async (projectId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, updates }),
      })

      const data = await res.json()
      if (data.success) {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...data.project } : p))
        if (selectedProject?.id === projectId) {
          setSelectedProject({ ...selectedProject, ...data.project })
        }
      }
    } catch (error) {
      console.error('Failed to update project:', error)
    }
  }

  const deleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects?projectId=${projectId}`, { method: 'DELETE' })
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectId))
        if (selectedProject?.id === projectId) {
          setSelectedProject(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    planning: projects.filter(p => p.status === 'planning').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalBudget: projects.reduce((sum, p) => sum + (p.budget_amount || 0), 0),
  }

  const ProjectCard = ({ project }: { project: Project }) => {
    const statusConfig = STATUS_CONFIG[project.status]
    const StatusIcon = statusConfig.icon
    const isOverdue = project.target_end_date && isPast(new Date(project.target_end_date)) && project.status !== 'completed'
    const daysRemaining = project.target_end_date
      ? differenceInDays(new Date(project.target_end_date), new Date())
      : null

    return (
      <Card
        className={`bg-zinc-800/50 border-zinc-700 cursor-pointer hover:bg-zinc-800 transition-colors ${
          selectedProject?.id === project.id ? 'ring-1 ring-blue-500' : ''
        }`}
        onClick={() => setSelectedProject(project)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                <StatusIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-200">{project.title}</h3>
                {project.category && (
                  <p className="text-xs text-zinc-500">{project.category}</p>
                )}
              </div>
            </div>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </div>

          {project.description && (
            <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{project.description}</p>
          )}

          {/* Progress */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-zinc-500">Progress</span>
              <span className="text-zinc-400">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-1.5" />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <ListTodo className="h-3.5 w-3.5" />
              {project.taskStats.completed}/{project.taskStats.total} tasks
            </span>

            {project.target_end_date && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
                <Calendar className="h-3.5 w-3.5" />
                {isOverdue ? 'Overdue' : daysRemaining !== null ? `${daysRemaining}d left` : format(new Date(project.target_end_date), 'MMM d')}
              </span>
            )}

            {project.budget_amount && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {project.budget_amount.toLocaleString()}
              </span>
            )}
          </div>

          {/* Linked RFP */}
          {project.rfp && (
            <div className="mt-3 pt-3 border-t border-zinc-700">
              <div className="flex items-center gap-2 text-xs">
                <Target className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-zinc-400">Linked to:</span>
                <span className="text-zinc-300 truncate">{project.rfp.title}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-zinc-100">{stats.total}</div>
            <div className="text-xs text-zinc-500">Total Projects</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
            <div className="text-xs text-zinc-500">Active</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.planning}</div>
            <div className="text-xs text-zinc-500">Planning</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-400">{stats.completed}</div>
            <div className="text-xs text-zinc-500">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-400">${(stats.totalBudget / 1000).toFixed(0)}k</div>
            <div className="text-xs text-zinc-500">Total Budget</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">Create Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                placeholder="Project title *"
                value={newProject.title}
                onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                className="bg-zinc-800 border-zinc-700"
              />
              <Textarea
                placeholder="Description"
                value={newProject.description}
                onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                className="bg-zinc-800 border-zinc-700"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                  <Select
                    value={newProject.category}
                    onValueChange={(v) => setNewProject(prev => ({ ...prev, category: v }))}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Priority</label>
                  <Select
                    value={String(newProject.priority)}
                    onValueChange={(v) => setNewProject(prev => ({ ...prev, priority: parseInt(v) }))}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Low</SelectItem>
                      <SelectItem value="2">Medium</SelectItem>
                      <SelectItem value="3">High</SelectItem>
                      <SelectItem value="4">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={newProject.startDate}
                    onChange={(e) => setNewProject(prev => ({ ...prev, startDate: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Target End Date</label>
                  <Input
                    type="date"
                    value={newProject.targetEndDate}
                    onChange={(e) => setNewProject(prev => ({ ...prev, targetEndDate: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Budget ($)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newProject.budgetAmount}
                    onChange={(e) => setNewProject(prev => ({ ...prev, budgetAmount: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                {rfps.length > 0 && (
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Link to RFP</label>
                    <Select
                      value={newProject.rfpId}
                      onValueChange={(v) => setNewProject(prev => ({ ...prev, rfpId: v }))}
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700">
                        <SelectValue placeholder="Select RFP" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {rfps.map(rfp => (
                          <SelectItem key={rfp.id} value={rfp.id}>{rfp.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Button onClick={createProject} className="w-full bg-blue-600 hover:bg-blue-700">
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-zinc-800">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORY_OPTIONS.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Project Grid and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {filteredProjects.length === 0 && (
              <div className="col-span-2 text-center py-12">
                <Folder className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400">No projects found</p>
                <p className="text-sm text-zinc-500 mt-1">Create a new project to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedProject ? (
            <Card className="bg-zinc-900 border-zinc-800 sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-zinc-100">{selectedProject.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-400"
                    onClick={() => deleteProject(selectedProject.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {selectedProject.category && (
                  <CardDescription>{selectedProject.category}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedProject.description && (
                  <p className="text-sm text-zinc-400">{selectedProject.description}</p>
                )}

                {/* Status */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">Status</label>
                  <Select
                    value={selectedProject.status}
                    onValueChange={(v) => updateProject(selectedProject.id, { status: v })}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Task Progress</span>
                    <span className="text-zinc-400">{selectedProject.progress}%</span>
                  </div>
                  <Progress value={selectedProject.progress} className="h-2" />
                  <p className="text-xs text-zinc-500">
                    {selectedProject.taskStats.completed} of {selectedProject.taskStats.total} tasks completed
                  </p>
                </div>

                {/* Timeline */}
                {(selectedProject.start_date || selectedProject.target_end_date) && (
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-500">Timeline</label>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      {selectedProject.start_date && (
                        <span>{format(new Date(selectedProject.start_date), 'MMM d, yyyy')}</span>
                      )}
                      {selectedProject.start_date && selectedProject.target_end_date && (
                        <ArrowRight className="h-4 w-4 text-zinc-600" />
                      )}
                      {selectedProject.target_end_date && (
                        <span>{format(new Date(selectedProject.target_end_date), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Budget */}
                {selectedProject.budget_amount && (
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-500">Budget</label>
                    <p className="text-lg font-medium text-zinc-200">
                      ${selectedProject.budget_amount.toLocaleString()} {selectedProject.budget_currency}
                    </p>
                  </div>
                )}

                {/* Linked RFP */}
                {selectedProject.rfp && (
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-500">Linked RFP</label>
                    <div className="p-3 bg-zinc-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-zinc-300">{selectedProject.rfp.title}</span>
                      </div>
                      <Badge className="mt-2" variant="outline">{selectedProject.rfp.status}</Badge>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="pt-4 border-t border-zinc-800">
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700"
                    onClick={() => window.location.href = `/workspace/${workspaceId}/tasks?projectId=${selectedProject.id}`}
                  >
                    <ListTodo className="h-4 w-4 mr-2" />
                    View Project Tasks
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-8 text-center">
                <Folder className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400">Select a project</p>
                <p className="text-sm text-zinc-500 mt-1">Click on a project to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
