'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Trash2,
  DollarSign,
  Calculator,
  Download,
  PieChart,
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react'

interface BudgetLineItem {
  id: string
  category: string
  description: string
  quantity: number
  unit: string
  unitCost: number
  total: number
  justification: string
  fundingSource: 'requested' | 'matching' | 'in_kind'
}

interface BudgetBuilderProps {
  proposalId: string
  initialBudget?: BudgetLineItem[]
  requestedAmount?: number
  matchingRequired?: number
  onSave?: (budget: BudgetLineItem[], summary: BudgetSummary) => void
}

interface BudgetSummary {
  totalRequested: number
  totalMatching: number
  totalInKind: number
  grandTotal: number
  byCategory: Record<string, number>
}

const BUDGET_CATEGORIES = [
  { value: 'personnel', label: 'Personnel & Salaries' },
  { value: 'fringe', label: 'Fringe Benefits' },
  { value: 'travel', label: 'Travel' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'contractual', label: 'Contractual/Consultants' },
  { value: 'construction', label: 'Construction' },
  { value: 'other', label: 'Other Direct Costs' },
  { value: 'indirect', label: 'Indirect/F&A Costs' },
]

const UNIT_OPTIONS = [
  'hour', 'day', 'week', 'month', 'year',
  'unit', 'trip', 'mile', 'each', 'lump sum'
]

export function BudgetBuilder({
  proposalId,
  initialBudget = [],
  requestedAmount = 0,
  matchingRequired = 0,
  onSave,
}: BudgetBuilderProps) {
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>(initialBudget)
  const [newItem, setNewItem] = useState<Partial<BudgetLineItem>>({
    category: 'personnel',
    description: '',
    quantity: 1,
    unit: 'month',
    unitCost: 0,
    justification: '',
    fundingSource: 'requested',
  })

  const calculateSummary = (): BudgetSummary => {
    const summary: BudgetSummary = {
      totalRequested: 0,
      totalMatching: 0,
      totalInKind: 0,
      grandTotal: 0,
      byCategory: {},
    }

    lineItems.forEach(item => {
      const total = item.quantity * item.unitCost

      if (item.fundingSource === 'requested') {
        summary.totalRequested += total
      } else if (item.fundingSource === 'matching') {
        summary.totalMatching += total
      } else {
        summary.totalInKind += total
      }

      summary.byCategory[item.category] = (summary.byCategory[item.category] || 0) + total
    })

    summary.grandTotal = summary.totalRequested + summary.totalMatching + summary.totalInKind

    return summary
  }

  const summary = calculateSummary()

  const addLineItem = () => {
    if (!newItem.description || newItem.unitCost === 0) return

    const item: BudgetLineItem = {
      id: `item-${Date.now()}`,
      category: newItem.category || 'other',
      description: newItem.description || '',
      quantity: newItem.quantity || 1,
      unit: newItem.unit || 'unit',
      unitCost: newItem.unitCost || 0,
      total: (newItem.quantity || 1) * (newItem.unitCost || 0),
      justification: newItem.justification || '',
      fundingSource: newItem.fundingSource || 'requested',
    }

    setLineItems(prev => [...prev, item])
    setNewItem({
      category: 'personnel',
      description: '',
      quantity: 1,
      unit: 'month',
      unitCost: 0,
      justification: '',
      fundingSource: 'requested',
    })
  }

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id))
  }

  const updateLineItem = (id: string, updates: Partial<BudgetLineItem>) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, ...updates }
      updated.total = updated.quantity * updated.unitCost
      return updated
    }))
  }

  const exportToCSV = () => {
    const headers = ['Category', 'Description', 'Quantity', 'Unit', 'Unit Cost', 'Total', 'Funding Source', 'Justification']
    const rows = lineItems.map(item => [
      BUDGET_CATEGORIES.find(c => c.value === item.category)?.label || item.category,
      item.description,
      item.quantity,
      item.unit,
      item.unitCost,
      item.total,
      item.fundingSource,
      item.justification,
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budget-${proposalId}.csv`
    a.click()
  }

  const handleSave = () => {
    if (onSave) {
      onSave(lineItems, summary)
    }
  }

  const budgetVariance = requestedAmount > 0 ? summary.totalRequested - requestedAmount : 0
  const matchingVariance = matchingRequired > 0 ? summary.totalMatching - matchingRequired : 0

  return (
    <div className="space-y-6">
      {/* Budget Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-zinc-500">Requested</span>
            </div>
            <div className="text-xl font-bold text-zinc-100">
              ${summary.totalRequested.toLocaleString()}
            </div>
            {requestedAmount > 0 && (
              <div className={`text-xs mt-1 ${
                Math.abs(budgetVariance) < 1 ? 'text-green-400' :
                budgetVariance > 0 ? 'text-red-400' : 'text-amber-400'
              }`}>
                {budgetVariance === 0 ? 'On target' :
                 budgetVariance > 0 ? `$${budgetVariance.toLocaleString()} over` :
                 `$${Math.abs(budgetVariance).toLocaleString()} under`}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-xs text-zinc-500">Matching</span>
            </div>
            <div className="text-xl font-bold text-zinc-100">
              ${summary.totalMatching.toLocaleString()}
            </div>
            {matchingRequired > 0 && (
              <div className={`text-xs mt-1 ${
                summary.totalMatching >= matchingRequired ? 'text-green-400' : 'text-amber-400'
              }`}>
                {summary.totalMatching >= matchingRequired ? 'Match met' :
                 `$${(matchingRequired - summary.totalMatching).toLocaleString()} needed`}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-zinc-500">In-Kind</span>
            </div>
            <div className="text-xl font-bold text-zinc-100">
              ${summary.totalInKind.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-zinc-500">Grand Total</span>
            </div>
            <div className="text-xl font-bold text-zinc-100">
              ${summary.grandTotal.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add New Line Item */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-100 text-lg">Add Budget Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Select
              value={newItem.category}
              onValueChange={(v) => setNewItem(prev => ({ ...prev, category: v }))}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Description"
              value={newItem.description}
              onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
              className="bg-zinc-800 border-zinc-700 md:col-span-2"
            />

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Qty"
                value={newItem.quantity || ''}
                onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                className="bg-zinc-800 border-zinc-700 w-20"
              />
              <Select
                value={newItem.unit}
                onValueChange={(v) => setNewItem(prev => ({ ...prev, unit: v }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              type="number"
              placeholder="Unit Cost"
              value={newItem.unitCost || ''}
              onChange={(e) => setNewItem(prev => ({ ...prev, unitCost: parseFloat(e.target.value) || 0 }))}
              className="bg-zinc-800 border-zinc-700"
            />

            <div className="flex gap-2">
              <Select
                value={newItem.fundingSource}
                onValueChange={(v) => setNewItem(prev => ({ ...prev, fundingSource: v as 'requested' | 'matching' | 'in_kind' }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="matching">Matching</SelectItem>
                  <SelectItem value="in_kind">In-Kind</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addLineItem} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-zinc-100 text-lg">Budget Line Items</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV} className="border-zinc-700">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              {onSave && (
                <Button size="sm" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                  Save Budget
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Calculator className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No budget items yet</p>
              <p className="text-xs">Add items above to build your budget</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">Category</TableHead>
                    <TableHead className="text-zinc-400">Description</TableHead>
                    <TableHead className="text-zinc-400 text-right">Qty</TableHead>
                    <TableHead className="text-zinc-400">Unit</TableHead>
                    <TableHead className="text-zinc-400 text-right">Unit Cost</TableHead>
                    <TableHead className="text-zinc-400 text-right">Total</TableHead>
                    <TableHead className="text-zinc-400">Source</TableHead>
                    <TableHead className="text-zinc-400 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map(item => (
                    <TableRow key={item.id} className="border-zinc-800 group">
                      <TableCell className="text-zinc-300">
                        <Select
                          value={item.category}
                          onValueChange={(v) => updateLineItem(item.id, { category: v })}
                        >
                          <SelectTrigger className="bg-transparent border-transparent hover:border-zinc-700 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BUDGET_CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                          className="bg-transparent border-transparent hover:border-zinc-700 h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-zinc-300 text-right">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="bg-transparent border-transparent hover:border-zinc-700 h-8 w-16 text-right text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-zinc-400">
                        <Select
                          value={item.unit}
                          onValueChange={(v) => updateLineItem(item.id, { unit: v })}
                        >
                          <SelectTrigger className="bg-transparent border-transparent hover:border-zinc-700 h-8 w-20 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map(unit => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-zinc-300 text-right">
                        <Input
                          type="number"
                          value={item.unitCost}
                          onChange={(e) => updateLineItem(item.id, { unitCost: parseFloat(e.target.value) || 0 })}
                          className="bg-transparent border-transparent hover:border-zinc-700 h-8 w-24 text-right text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-zinc-100 font-medium text-right">${item.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Select
                          value={item.fundingSource}
                          onValueChange={(v) => updateLineItem(item.id, { fundingSource: v as 'requested' | 'matching' | 'in_kind' })}
                        >
                          <SelectTrigger className={`h-7 text-xs border-transparent ${
                            item.fundingSource === 'requested' ? 'bg-blue-500/20 text-blue-400' :
                            item.fundingSource === 'matching' ? 'bg-green-500/20 text-green-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="requested">Requested</SelectItem>
                            <SelectItem value="matching">Matching</SelectItem>
                            <SelectItem value="in_kind">In-Kind</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          onClick={() => removeLineItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {lineItems.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-100 text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Budget by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => {
                  const percentage = (amount / summary.grandTotal) * 100
                  return (
                    <div key={category} className="p-3 bg-zinc-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-400">
                          {BUDGET_CATEGORIES.find(c => c.value === category)?.label || category}
                        </span>
                        <span className="text-xs text-zinc-500">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="text-lg font-medium text-zinc-200">
                        ${amount.toLocaleString()}
                      </div>
                      <div className="mt-2 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
