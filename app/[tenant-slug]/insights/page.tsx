import { Card, CardContent } from '@/components/ui/card'

export default function InsightsPage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold leading-tight">AI Insights</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <h2 className="text-xl font-semibold leading-tight">Insights em construção</h2>
          <p className="text-sm font-normal text-muted-foreground">
            Os insights de IA estarão disponíveis na Fase 4.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
