import { Card, CardContent } from '@/components/ui/card'

export default function CampanhasPage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold leading-tight">Campanhas</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <h2 className="text-xl font-semibold leading-tight">Campanhas em construção</h2>
          <p className="text-sm font-normal text-muted-foreground">
            A listagem de campanhas estará disponível na Fase 3.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
