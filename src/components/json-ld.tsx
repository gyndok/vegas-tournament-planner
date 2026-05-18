/**
 * Renders a JSON-LD script block. Keep all JSON-LD shapes in lib/seo.ts;
 * this component just serializes them safely. Suppressing hydration is
 * fine here — the script tag contents are static JSON.
 */

interface JsonLdProps {
  data: object | object[]
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
