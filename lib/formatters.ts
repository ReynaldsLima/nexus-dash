export const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v)

export const num = (v: number) => new Intl.NumberFormat('pt-BR').format(v)
