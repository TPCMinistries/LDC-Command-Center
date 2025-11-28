'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  Folder,
  MoreHorizontal,
  Trash2,
  Edit,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Filter,
  Bot,
} from 'lucide-react'
import { format, isPast, isToday, isTomorrow, addDays } from 'date-fns'

interface Task {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
  priority: number
  due_date: string | null
  project_id: string | null
  project?: { id: string; title: string } | null
  assigned_to: string | null
  assigned_agent: string | null
  checklist: unknown[]
  notes: string | null
  source: string
  created_at: string
}

interface Project {
  id: string
  title: string
  status: string
}

interface TasksClientProps {
  workspaceId: string
  initialTasks: Task[]
  projects: Project[]
}

const PRIORITY_LABELS: Record<number, { label: string; color: string; icon: typeof ArrowUp }> = {
  1: { label: 'Low', color: 'text-zinc-400', icon: ArrowDown },
  2: { label: 'Medium', color: 'text-blue-400', icon: ArrowRight },
  3: { label: 'High', color: 'text-orange-400', icon: ArrowUp },
  4: { label: 'Urgent', color: 'text-red-400', icon: AlertCircle },
}

const STATUS_CONFIG = {
  todo: { label: 'To Do', color: 'bg-zinc-500/20 text-zinc-400', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-400', icon: Clock },
  blocked: { label: 'Blocked', color: 'bg-red-500/20 text-red-400', icon: AlertCircle },
  done: { label: 'Done', color: 'bg-green-500/20 text-green-400', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-zinc-500/20 text-zinc-500', icon: Circle },
}

export function TasksClient({ workspaceId, initialTasks, projects }: TasksClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('active')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 2,
    dueDate: '',
    projectId: '',
  })

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active' && (task.status === 'done' || task.status === 'cancelled')) return false
    if (filter === 'done' && task.status !== 'done') return false
    if (projectFilter !== 'all' && task.project_id !== projectFilter) return false
    return true
  })

  const groupedTasks = {
    overdue: filteredTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'done'),
    today: filteredTasks.filter(t => t.due_date && isToday(new Date(t.due_date))),
    tomorrow: filteredTasks.filter(t => t.due_date && isTomorrow(new Date(t.due_date))),
    upcoming: filteredTasks.filter(t => {
      if (!t.due_date) return false
      const date = new Date(t.due_date)
      return !isPast(date) && !isToday(date) && !isTomorrow(date) && date <= addDays(new Date(), 7)
    }),
    later: filteredTasks.filter(t => {
      if (!t.due_date) return false
      return new Date(t.due_date) > addDays(new Date(), 7)
    }),
    noDue: filteredTasks.filter(t => !t.due_date),
  }

  const createTask = async () => {
    if (!newTask.title.trim()) return

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          task: {
            title: newTask.title,
            description: newTask.description || null,
            priority: newTask.priority,
            dueDate: newTask.dueDate || null,
            projectId: newTask.projectId || null,
          },
        }),
      })

      const data = await res.json()
      if (data.success) {
        const taskWithProject = {
          ...data.task,
          project: newTask.projectId
            ? projects.find(p => p.id === newTask.projectId)
            : null,
        }
        setTasks(prev => [taskWithProject, ...prev])
        setNewTask({ title: '', description: '', priority: 2, dueDate: '', projectId: '' })
        setIsCreateOpen(false)
      }
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, updates }),
      })

      const data = await res.json()
      if (data.success) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...data.task } : t))
      }
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks?taskId=${taskId}`, { method: 'DELETE' })
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId))
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    updateTask(task.id, { status: newStatus })
  }

  const TaskItem = ({ task }: { task: Task }) => {
    const StatusIcon = STATUS_CONFIG[task.status].icon
    const PriorityIcon = PRIORITY_LABELS[task.priority]?.icon || ArrowRight
    const priorityColor = PRIORITY_LABELS[task.priority]?.color || 'text-zinc-400'

    return (
      <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group">
        <button
          onClick={() => toggleTaskStatus(task)}
          className="mt-0.5 flex-shrink-0"
        >
          <StatusIcon className={`h-5 w-5 ${
            task.status === 'done' ? 'text-green-500' : 'text-zinc-500 hover:text-zinc-300'
          }`} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                task.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200'
              }`}>
                {task.title}
              </p>
              {task.description && (
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{task.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setEditingTask(task)}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                onClick={() => deleteTask(task.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <PriorityIcon className={`h-3.5 w-3.5 ${priorityColor}`} />

            {task.due_date && (
              <span className={`text-xs flex items-center gap-1 ${
                isPast(new Date(task.due_date)) && task.status !== 'done'
                  ? 'text-red-400'
                  : 'text-zinc-500'
              }`}>
                <Calendar className="h-3 w-3" />
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}

            {task.project && (
              <Badge variant="outline" className="text-xs py-0 h-5">
                <Folder className="h-3 w-3 mr-1" />
                {task.project.title}
              </Badge>
            )}

            {task.source === 'agent' && (
              <Badge className="bg-purple-500/20 text-purple-400 text-xs py-0 h-5">
                <Bot className="h-3 w-3 mr-1" />
                AI
              </Badge>
            )}

            <Badge className={`${STATUS_CONFIG[task.status].color} text-xs py-0 h-5`}>
              {STATUS_CONFIG[task.status].label}
            </Badge>
          </div>
        </div>
      </div>
    )
  }

  const TaskSection = ({ title, tasks, color }: { title: string; tasks: Task[]; color: string }) => {
    if (tasks.length === 0) return null

    return (
      <div className="space-y-2">
        <h3 className={`text-sm font-medium ${color}`}>{title} ({tasks.length})</h3>
        <div className="space-y-2">
          {tasks.map(task => <TaskItem key={task.id} task={task} />)}
        </div>
      </div>
    )
  }

  const stats = {
    total: tasks.length,
    active: tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
    completed: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'done').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-zinc-100">{stats.total}</div>
            <div className="text-xs text-zinc-500">Total Tasks</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.active}</div>
            <div className="text-xs text-zinc-500">Active</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-xs text-zinc-500">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{stats.overdue}</div>
            <div className="text-xs text-zinc-500">Overdue</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">Create Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="bg-zinc-800 border-zinc-700"
              />
              <Textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                className="bg-zinc-800 border-zinc-700"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Priority</label>
                  <Select
                    value={String(newTask.priority)}
                    onValueChange={(v) => setNewTask(prev => ({ ...prev, priority: parseInt(v) }))}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Low</SelectItem>
                      <SelectItem value="2">Medium</SelectItem>
                      <SelectItem value="3">High</SelectItem>
                      <SelectItem value="4">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Due Date</label>
                  <Input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>
              {projects.length > 0 && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Project</label>
                  <Select
                    value={newTask.projectId}
                    onValueChange={(v) => setNewTask(prev => ({ ...prev, projectId: v }))}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="Select project (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Project</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={createTask} className="w-full bg-blue-600 hover:bg-blue-700">
                Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-500" />
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="bg-zinc-800">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="done">Done</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {projects.length > 0 && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Task List */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-6">
          <div className="space-y-6">
            <TaskSection title="Overdue" tasks={groupedTasks.overdue} color="text-red-400" />
            <TaskSection title="Today" tasks={groupedTasks.today} color="text-amber-400" />
            <TaskSection title="Tomorrow" tasks={groupedTasks.tomorrow} color="text-blue-400" />
            <TaskSection title="This Week" tasks={groupedTasks.upcoming} color="text-zinc-300" />
            <TaskSection title="Later" tasks={groupedTasks.later} color="text-zinc-400" />
            <TaskSection title="No Due Date" tasks={groupedTasks.noDue} color="text-zinc-500" />

            {filteredTasks.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400">No tasks found</p>
                <p className="text-sm text-zinc-500 mt-1">Create a new task to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Edit Task</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4 mt-4">
              <Input
                placeholder="Task title"
                value={editingTask.title}
                onChange={(e) => setEditingTask(prev => prev ? { ...prev, title: e.target.value } : null)}
                className="bg-zinc-800 border-zinc-700"
              />
              <Textarea
                placeholder="Description"
                value={editingTask.description || ''}
                onChange={(e) => setEditingTask(prev => prev ? { ...prev, description: e.target.value } : null)}
                className="bg-zinc-800 border-zinc-700"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Status</label>
                  <Select
                    value={editingTask.status}
                    onValueChange={(v) => setEditingTask(prev => prev ? { ...prev, status: v as Task['status'] } : null)}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Priority</label>
                  <Select
                    value={String(editingTask.priority)}
                    onValueChange={(v) => setEditingTask(prev => prev ? { ...prev, priority: parseInt(v) } : null)}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Low</SelectItem>
                      <SelectItem value="2">Medium</SelectItem>
                      <SelectItem value="3">High</SelectItem>
                      <SelectItem value="4">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Due Date</label>
                <Input
                  type="date"
                  value={editingTask.due_date || ''}
                  onChange={(e) => setEditingTask(prev => prev ? { ...prev, due_date: e.target.value } : null)}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              <Button
                onClick={() => {
                  if (editingTask) {
                    updateTask(editingTask.id, {
                      title: editingTask.title,
                      description: editingTask.description,
                      status: editingTask.status,
                      priority: editingTask.priority,
                      dueDate: editingTask.due_date,
                    } as Partial<Task>)
                    setEditingTask(null)
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
