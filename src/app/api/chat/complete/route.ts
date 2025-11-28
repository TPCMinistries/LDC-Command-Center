import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

// Initialize clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Model configurations - latest versions
const MODELS = {
  // Anthropic Claude
  'claude': 'claude-sonnet-4-20250514',
  'claude-opus': 'claude-opus-4-20250514',
  'claude-3.5': 'claude-3-5-sonnet-20241022',
  // OpenAI GPT-5.1 (newest - Nov 2025)
  'gpt-5.1': 'gpt-5.1',
  'gpt-5.1-thinking': 'gpt-5.1-thinking',
  // OpenAI GPT-4 series
  'gpt-4.1': 'gpt-4.1',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'o1': 'o1',
  'o1-mini': 'o1-mini',
}

// POST - Send message and get completion
export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    conversationId,
    message,
    model = 'claude',
    systemPrompt,
    contextData, // Optional context for help widget
  } = body

  if (!conversationId || !message) {
    return NextResponse.json({ error: 'Conversation ID and message required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Save user message
    await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    })

    // Get conversation history
    const { data: history } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50)

    const messages: Message[] = (history || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Build system prompt
    let finalSystemPrompt = systemPrompt || 'You are a helpful AI assistant.'

    if (contextData) {
      finalSystemPrompt += `\n\nContext about what the user is currently viewing:\n${JSON.stringify(contextData, null, 2)}`
    }

    let assistantResponse: string
    let tokensUsed: number | undefined

    // Route to appropriate model
    if (model.startsWith('gpt')) {
      // OpenAI
      const modelId = MODELS[model as keyof typeof MODELS] || 'gpt-4-turbo-preview'

      const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: finalSystemPrompt },
        ...messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ]

      const completion = await openai.chat.completions.create({
        model: modelId,
        messages: openaiMessages,
        max_tokens: 4096,
        temperature: 0.7,
      })

      assistantResponse = completion.choices[0]?.message?.content || 'No response generated.'
      tokensUsed = completion.usage?.total_tokens
    } else {
      // Claude
      const modelId = MODELS[model as keyof typeof MODELS] || 'claude-sonnet-4-20250514'

      const claudeMessages = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const completion = await anthropic.messages.create({
        model: modelId,
        max_tokens: 4096,
        system: finalSystemPrompt,
        messages: claudeMessages,
      })

      const textBlock = completion.content.find(block => block.type === 'text')
      assistantResponse = textBlock?.type === 'text' ? textBlock.text : 'No response generated.'
      tokensUsed = completion.usage?.input_tokens + completion.usage?.output_tokens
    }

    // Save assistant response
    const { data: savedMessage, error: saveError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantResponse,
        model: MODELS[model as keyof typeof MODELS] || model,
        tokens_used: tokensUsed,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving assistant message:', saveError)
    }

    return NextResponse.json({
      message: savedMessage || { content: assistantResponse, role: 'assistant' },
      tokensUsed,
    })
  } catch (error) {
    console.error('Chat completion error:', error)

    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json({
          error: `API key not configured for ${model}. Please check your environment variables.`
        }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
