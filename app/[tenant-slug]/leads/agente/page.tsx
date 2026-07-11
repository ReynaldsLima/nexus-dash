'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Send, Bot, User, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { type Lead, cat, CATEGORY_LABELS } from '@/lib/leads'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function buildSystem(leads: Lead[]): string {
  const total = leads.length
  const novo   = leads.filter(l => cat(l.status) === 'novo').length
  const quente = leads.filter(l => cat(l.status) === 'quente').length
  const negoc  = leads.filter(l => cat(l.status) === 'negoc').length
  const fim    = leads.filter(l => cat(l.status) === 'fim').length

  const sample = leads.slice(0, 50).map(l =>
    `- ${l.nome || '?'} | ${l.empresa || '?'} | ${l.tipo_seguro || '?'} | ${CATEGORY_LABELS[cat(l.status)]} | ${l.criado_em || '?'}`
  ).join('\n')

  return `Você é um assistente especialista em análise de leads para uma corretora de seguros.

BASE DE LEADS ATUAL:
- Total: ${total} leads
- Novos: ${novo} | Quentes: ${quente} | Negociando: ${negoc} | Sem Resposta: ${fim}
- Taxa de aquecimento: ${total ? Math.round(quente / total * 100) : 0}%
- Taxa de negociação: ${total ? Math.round(negoc / total * 100) : 0}%

AMOSTRA DOS LEADS (primeiros 50):
${sample}

Responda sempre em português do Brasil. Seja direto, analítico e orientado a ações. Quando sugerir abordagens, baseie-se nos dados reais acima. Não invente informações que não estejam nos dados.`
}

export default function AgenteLeadsPage() {
  const params = useParams()
  const slug = params['tenant-slug'] as string

  const [leads, setLeads] = useState<Lead[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingLeads, setLoadingLeads] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch(`/api/leads?tenant=${slug}`)
      .then(r => r.json())
      .then(d => { if (d.leads) setLeads(d.leads) })
      .finally(() => setLoadingLeads(false))
  }, [slug])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/leads/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant: slug,                                            // D-05
          system: buildSystem(leads),
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) {
        // resposta de erro é JSON { error }, não um stream de texto
        let msg = 'Erro ao processar resposta.'
        try { const err = await res.json(); msg = err?.error ?? msg } catch { /* corpo não-JSON */ }
        setMessages(m => [...m, { role: 'assistant', content: msg }])
        return
      }

      // sucesso: corpo é um stream text/plain (streamText().toTextStreamResponse())
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let reply = ''
      // adiciona uma mensagem vazia do assistente e vai preenchendo conforme os chunks chegam
      setMessages(m => [...m, { role: 'assistant', content: '' }])
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value, { stream: true })
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: reply }
          return copy
        })
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Erro de conexão: ${(e as Error).message}` }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const SUGGESTIONS = [
    'Quais leads devo priorizar hoje?',
    'Qual o perfil dos leads que mais convertem?',
    'Sugira abordagens para leads sem resposta.',
    'Quantos leads estão em cada etapa do funil?',
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)] max-h-[820px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/${slug}/leads`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Leads
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-sidebar-primary/20 flex items-center justify-center">
            <Bot className="size-3.5 text-sidebar-primary" />
          </div>
          <span className="text-sm font-medium">Agente IA</span>
          {!loadingLeads && (
            <span className="text-xs text-muted-foreground">· {leads.length} leads carregados</span>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Welcome state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
              <div className="size-14 rounded-2xl bg-sidebar-primary/15 flex items-center justify-center">
                <Bot className="size-7 text-sidebar-primary" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold">Agente de Leads IA</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Analiso seus leads e sugiro ações. Faça perguntas sobre o funil, prioridades ou estratégias de abordagem.
                </p>
              </div>
              {leads.length > 0 && (
                <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus() }}
                      className="text-left px-3 py-2.5 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
              <div className={cn(
                'size-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                msg.role === 'user' ? 'bg-sidebar-primary' : 'bg-muted',
              )}>
                {msg.role === 'user'
                  ? <User className="size-3.5 text-sidebar-primary-foreground" />
                  : <Bot className="size-3.5 text-foreground" />
                }
              </div>
              <div className={cn(
                'max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground rounded-tr-sm'
                  : 'bg-muted/60 text-foreground rounded-tl-sm',
              )}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex gap-3">
              <div className="size-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="size-3.5" />
              </div>
              <div className="bg-muted/60 rounded-xl rounded-tl-sm px-4 py-3">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte sobre seus leads… (Enter para enviar)"
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none resize-none placeholder:text-muted-foreground/60 py-1.5 max-h-32"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="size-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
