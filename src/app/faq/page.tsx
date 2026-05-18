import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { HelpCircle } from 'lucide-react'

interface FaqItem {
  question: string
  answer: string
}

interface FaqSection {
  id: string
  title: string
  blurb?: string
  items: FaqItem[]
}

const sections: FaqSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      {
        question: 'What is NextRebuy?',
        answer:
          'NextRebuy is a planning tool for Vegas poker tournament players. It helps you browse upcoming tournaments across major series (WSOP, Wynn, Venetian, etc.), build a personalized schedule, track your trip budget, and get AI-powered recommendations — all in one place.',
      },
      {
        question: 'Do I need an account to use NextRebuy?',
        answer:
          'You can browse tournaments without an account. To save tournaments to your schedule, use favorites, share your schedule, or access the AI Advisor, you\'ll need to sign in with a free account.',
      },
      {
        question: 'How do I browse tournaments?',
        answer:
          'Click "Browse" in the sidebar to see all upcoming tournaments. You can filter by casino, buy-in range, game type, format, date range, and more. Use the search bar to find specific tournaments by name. Results load automatically as you scroll.',
      },
    ],
  },
  {
    id: 'schedule',
    title: 'Schedule & Custom Tournaments',
    items: [
      {
        question: 'How do I add a tournament to my schedule?',
        answer:
          'When viewing a tournament (from Browse or the Dashboard), click the "Add to Schedule" button. You can set a priority level (Target, Interested, or Backup) and add personal notes. The tournament will appear on your Schedule page.',
      },
      {
        question: 'What do the priority levels mean?',
        answer:
          'Target means you\'re definitely playing this one. Interested means you\'re considering it. Backup means it\'s a fallback option if your target tournament doesn\'t work out. These help you organize a busy schedule with overlapping events.',
      },
      {
        question: 'Can I add my own tournaments (home games, smaller venues)?',
        answer:
          'Yes! Go to your Schedule page and click "Add Tournament." You can enter any tournament — home games, charity events, smaller casino dailies, or anything not in our database. These custom tournaments appear alongside regular tournaments on your schedule.',
      },
      {
        question: 'How do I export my schedule to my phone\'s calendar?',
        answer:
          'On your Schedule page, click the "Export .ics" button. This downloads a calendar file that you can import into Google Calendar, Apple Calendar, Outlook, or any app that supports .ics files.',
      },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing Your Schedule',
    items: [
      {
        question: 'How do I share my schedule with friends?',
        answer:
          'On your Schedule page, toggle on "Share Schedule." This generates a unique link you can copy and send to anyone. They\'ll see a read-only view of your tournament schedule — your personal notes are hidden for privacy.',
      },
      {
        question: 'Can people see my notes on the shared schedule?',
        answer:
          'No. When you share your schedule, your personal notes are automatically hidden. Only tournament details (name, date, time, venue, buy-in) and your priority levels are visible.',
      },
      {
        question: 'How do I stop sharing my schedule?',
        answer:
          'Toggle off "Share Schedule" on your Schedule page. The link will immediately stop working. If you turn sharing back on, the same link will work again. You can also regenerate a new link if you want to invalidate the old one.',
      },
    ],
  },
  {
    id: 'trip-planner',
    title: 'Trip Planner & Bankroll',
    items: [
      {
        question: 'What is the Trip Planner?',
        answer:
          'The Trip Planner is your day-by-day Vegas itinerary. Set your arrival and departure dates in Settings, and it builds a daily view showing your scheduled tournaments, available tournaments you can quick-add, budget tracking, and a results summary. It\'s the hub for managing your entire trip.',
      },
      {
        question: 'How do I log my tournament results?',
        answer:
          'On the Trip Planner page, each scheduled tournament has a "Log" button (trophy icon). Click it to enter your cash-out amount, finish position, and optional notes. The dialog shows your profit or loss in real time based on the buy-in. Once you\'ve logged at least one result, a Results Summary appears at the top of your Trip Planner showing your Net P&L, games played, and ROI.',
      },
      {
        question: 'Can I edit or delete a logged result?',
        answer:
          'Yes. After logging a result, the "Log" button turns into a colored profit/loss badge (green for profit, red for loss). Click the badge to edit your cash-out amount, finish position, or notes. You can also delete the result entirely from the edit dialog.',
      },
    ],
  },
  {
    id: 'last-longer-pools',
    title: 'Last Longer Pools',
    blurb:
      'Side bets among friends about who lasts the longest in a tournament. NextRebuy tracks the standings — it does not handle money.',
    items: [
      {
        question: 'What is a Last Longer Pool?',
        answer:
          'A Last Longer Pool is a side contest among a group of friends playing the same tournament. The last player still alive in the tournament wins the pool. NextRebuy keeps a live leaderboard for the group: who is still in, who busted (and when), and current chip counts. Standings are private to pool members.',
      },
      {
        question: 'Does NextRebuy collect or pay out money?',
        answer:
          'No. NextRebuy never handles money in any form — no buy-ins, no payouts, no escrow, no payment processing. The site only tracks who is alive and who busted. Any entry fees, prize splits, or payouts are arranged and settled directly between the pool organizer and the players (Venmo, cash, whatever you agree on). The organizer is responsible for all outside accounting.',
      },
      {
        question: 'I\'m running a pool — what are my responsibilities as the organizer?',
        answer:
          'You are the bank. You collect entry fees from your players (cash, Venmo, Zelle, however you agree), hold the prize money during the tournament, and pay out the winner once a champion is decided. NextRebuy does not track who has paid or who is owed — that\'s on you. We recommend collecting all buy-ins before the tournament starts, writing down who paid what, and confirming the payout terms in writing (group chat is fine) so there are no disputes later. Locking the pool before the cards are in the air is a good practice.',
      },
      {
        question: 'How do I create a pool?',
        answer:
          'Open the tournament page for the event you\'re playing and click "Create Last Longer Pool." For a home game or charity event not in our database, add it as a Custom Tournament first, then create a pool from there. You\'ll get an invite link to share with your group. Anyone with the link can join as long as they have a NextRebuy account.',
      },
      {
        question: 'How do players join a pool?',
        answer:
          'The organizer shares the invite link. The invitee opens the link, signs in (or creates a free account), and clicks "Join pool." Once joined, the tournament is automatically added to their schedule. Joining costs nothing on NextRebuy — you settle the actual entry fee with the organizer outside the app.',
      },
      {
        question: 'What is "Re-entries keep you alive"?',
        answer:
          'In a re-entry tournament, busting and re-entering is common. With this option on (the default), busting and re-buying keeps you alive in the pool — you\'re only out when you can no longer re-enter. With it off, your first bust is your last and you\'re out of the pool regardless of whether you re-enter the tournament.',
      },
      {
        question: 'What is the multi-flight rule?',
        answer:
          'Big tournaments often run multiple opening flights (Day 1A, 1B, 1C). "Out only after last flight bust" means a player who busts an early flight is still alive in the pool until they bust every flight they enter. "Out on first flight bust" treats your first bust as your final bust. Set this once when creating the pool to match what your group agreed on.',
      },
      {
        question: 'How do chip counts work?',
        answer:
          'Once a tournament is underway, players can update their own chip count from the pool page so the group can see who has the lead. The site does not verify chip counts against the casino — it\'s honor-system. Update yours during breaks. When you bust, mark yourself out.',
      },
      {
        question: 'Can I see other pools or their standings?',
        answer:
          'No. Pool standings are private to the members of that pool. Different groups can run independent pools on the same tournament without any of them seeing each other.',
      },
      {
        question: 'What happens if the tournament gets cancelled?',
        answer:
          'If the underlying tournament disappears from the official schedule for several consecutive days, the pool is automatically cancelled and members are emailed. The organizer can also cancel manually at any time from the pool page. Cancellation just closes the pool on NextRebuy — refunding entry fees is up to the organizer.',
      },
      {
        question: 'Can I leave a pool?',
        answer:
          'Yes. From the pool page, players can remove themselves at any time before busting. The organizer can also remove members. Anything you owe or are owed has to be settled between you and the organizer outside the app.',
      },
    ],
  },
  {
    id: 'ai-advisor',
    title: 'AI Advisor',
    items: [
      {
        question: 'What is the AI Advisor?',
        answer:
          'The AI Advisor is a chat assistant that knows about all the tournaments in our database. Ask it questions like "What\'s the best $500 NLH tournament this week?" or "Compare the WSOP and Wynn series for PLO" and it\'ll give you personalized recommendations.',
      },
      {
        question: 'What are good questions to ask the AI Advisor?',
        answer:
          'The AI works best with specific questions. Try: "What NLH tournaments under $500 are running this Saturday?", "Compare the WSOP and Wynn series for PLO players", "I have a $3,000 budget for 5 days — build me a schedule", or "What\'s the best value tournament this week?" You can also ask about formats, structures, or help deciding between overlapping events.',
      },
      {
        question: 'Is the AI advice reliable?',
        answer:
          'The AI Advisor uses real tournament data from our database and general poker knowledge. It\'s great for comparing options, finding tournaments that match your preferences, and getting a quick overview. However, always verify critical details (like start times and buy-ins) against the official casino schedule.',
      },
    ],
  },
  {
    id: 'favorites',
    title: 'Favorites & Discovery',
    items: [
      {
        question: 'What\'s the difference between favorites and my schedule?',
        answer:
          'Favorites is a quick-save feature — heart a tournament to bookmark it for later. Your schedule is your actual plan with priorities and notes. Think of favorites as your watchlist and your schedule as your committed plan.',
      },
      {
        question: 'How do I find similar tournaments?',
        answer:
          'When viewing a tournament\'s detail page, scroll down to see "Similar Tournaments." These are tournaments with a similar buy-in, game type, and format happening around the same time — useful for finding alternatives.',
      },
    ],
  },
  {
    id: 'general',
    title: 'General & Privacy',
    items: [
      {
        question: 'Where does the tournament data come from?',
        answer:
          'Tournament data is sourced from official casino schedules and poker series announcements. We regularly update the database to ensure accuracy, but always confirm details with the venue before making travel plans.',
      },
      {
        question: 'Is NextRebuy free?',
        answer:
          'Yes, NextRebuy is currently free to use. All features — browsing, scheduling, sharing, trip planning, Last Longer Pools, and the AI Advisor — are available at no cost.',
      },
      {
        question: 'Do you collect or sell my data?',
        answer:
          'No. We only store what you explicitly save — your schedule, preferences, favorites, and tournament results. We don\'t track your browsing behavior, sell your information to third parties, or share it with advertisers. Your email is used solely for authentication.',
      },
    ],
  },
]

export default function FAQPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <HelpCircle className="size-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Frequently Asked Questions</h1>
          <p className="text-sm text-muted-foreground">
            Everything you need to know about using NextRebuy
          </p>
        </div>
      </div>

      <nav aria-label="FAQ sections" className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Jump to
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary underline underline-offset-4 hover:text-primary/80">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="space-y-3 scroll-mt-20">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.blurb && (
            <p className="text-sm text-muted-foreground">{section.blurb}</p>
          )}
          <Accordion type="multiple" className="w-full">
            {section.items.map((item, index) => (
              <AccordionItem key={index} value={`${section.id}-${index}`}>
                <AccordionTrigger className="text-left text-[15px]">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}

      <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p>
          Still have questions? Use the{' '}
          <a href="/chat" className="text-primary underline underline-offset-4 hover:text-primary/80">
            AI Advisor
          </a>{' '}
          to ask anything about tournaments, reach out at{' '}
          <span className="font-medium text-foreground">support@nextrebuy.com</span>
          , or join our community on{' '}
          <a
            href="https://t.me/nextrebuy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Telegram
          </a>
          .
        </p>
      </div>
    </div>
  )
}
