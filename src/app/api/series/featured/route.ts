import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Series } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('series')
    .select('id, name, venue, start_date, end_date, website_url, is_featured, created_at')
    .eq('is_featured', true)
    .order('start_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json((data as Series[]) ?? [])
}
