# PRD — billyfrazier.is (v1) — approved 2026-08-19

## Reference
- Visual/structural reference: annamackenzie.com (Framer). Screenshot + CSS tokens captured 2026-08-19.
- Palette from reference: `#fff` bg, `#181818` ink, `#ff4405` accent, `#f0f0f0` section grey, `#888 / #646464 / #757575` muted.
- Type feel: oversized condensed display name, editorial serif headings, clean sans body.

## Goals (from Billy, 2026-08-19)
1. Promote writing and speaking
2. Promote first book
3. Capture email
4. Drive subscribers to Substack
5. Share future creative projects / digital products

("Capture email" = a contact form — book a talk / hire for a project / ask a question — not a separate mailing list. Newsletter signup = Substack.)

## Book
- *Fumbling Forward* by Billy Frazier — memoir-meets-career-guide, humorous, five career stages. Out now (print + ebook).
- Landing page: https://www.fumblingbook.com/
- Retailers: Amazon (print), BookBaby (print), Apple Books, Barnes & Noble, Bookshop.org (ebook).
- Decision: personal site **links out** to fumblingbook.com (and/or retailers); it does not absorb the book page.
- Tone: self-deprecating humour (fake blurbs from author's inner monologue and mum).

## Problem
Billy's audience-facing presence is fragmented (fumblingbook.com, Substack, Medium) with no home base that sells the book, fields speaking/hiring enquiries, and grows the newsletter from one page.

## Users / audience
- Primary: anyone seeking alternative / humorous career advice — students, freelancers, full-time employees.
- Primary action: **buy the book**.
- Secondary actions: email contact; subscribe to Substack.

## Writing
- Lives off-site: Substack https://fumblingforward.substack.com/ and Medium https://medium.com/@billyfrazr
- Site shows latest posts (feed) + Substack subscribe; no native articles in v1.

## Speaking
- "Book me to speak" section: topics + enquiry CTA.
- Past/upcoming talks list (with video where available).

## Core flows / structure (v1 — approved)
One long home page, reference-style:
1. Hero: giant "Billy Frazier" display name + photo(s)
2. Intro one-liner + CTA
3. Book: *Fumbling Forward* — cover, humour blurbs, "Get the book" -> fumblingbook.com
4. Speaking: topics + "book me" CTA + past talks list
5. Latest writing: Substack + Medium feed (build-time RSS)
6. Substack subscribe block
7. Contact form (speak / hire / question)
8. Footer

## Scope cuts (v1)
- Projects/products section (structure ready, hidden until first product)
- Native blog, talk-video gallery, dark mode

## Success metrics (tracked via free Vercel Analytics)
- Outbound clicks on "Get the book"
- Substack subscribes originating from the site
- Contact-form submissions (esp. speaking enquiries)

## Constraints (stack, hosting, budget)
- Stack: **Astro** (static), hosted free on **Vercel**.
- Domain: **billyfrazier.is** (already owned).
- Feeds: Substack + Medium RSS pulled at build time.
- Contact form: free-tier form service (Web3Forms/Formspree) → Billy's inbox; no mailing-list provider.
- Budget: $0 recurring beyond existing domain.

## Risks
- Reference-clone risk: take structural inspiration from annamackenzie.com, don't copy it one-to-one.
- Photos: placeholders until Billy supplies real images.
- Medium RSS can be flaky/truncated; degrade gracefully if a feed fails at build.
- Contact form needs a Web3Forms/Formspree key from Billy before submissions reach his inbox.
