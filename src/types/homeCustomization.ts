import type { HeroSliderContent } from './heroSlider'

export type EditableNavLink = {
  id: string
  label: string
  href: string
}

export type EditableButton = {
  text: string
  href?: string
  color: string
  icon: 'arrow' | 'phone' | 'none'
}

export type EditableImage = {
  src: string
  alt: string
  href?: string
}

export type HomeCustomizationContent = {
  heroSlider?: HeroSliderContent
  nav: {
    logo: EditableImage
    links: EditableNavLink[]
    inquiryButton: EditableButton
  }
  hero: {
    kicker: string
    title: string
    subtitle: string
    cta: EditableButton
    background: EditableImage
  }
  story: {
    label: string
    title: string
    paragraphs: string[]
    badges: EditableImage[]
  }
  signature: {
    title: string
    description: string
    image: EditableImage
    founderName: string
    founderRole: string
    items: Array<{ id: string; title: string; text: string; icon?: EditableImage }>
  }
  featuredTours: {
    label: string
    title: string
    description: string
  }
  journey: {
    label: string
    title: string
    description: string
    cta: EditableButton
    image: EditableImage
    thumbnail: EditableImage
  }
  why: {
    label: string
    title: string
    description: string
    cards: Array<{ id: string; title: string; text: string; icon?: EditableImage }>
  }
  gallery: {
    label: string
    title: string
    description: string
    images: EditableImage[]
  }
  reviews: {
    title: string
    description: string
  }
  footerBand: EditableImage
  footer: {
    about: string
    phone: string
    email: string
    location: string
    quickLinks: EditableNavLink[]
    socials: EditableNavLink[]
  }
  sectionOrder: string[]
  hiddenSections: string[]
}

export type HomepageCustomizationRow = {
  id: string
  page_key: string
  draft_content: Partial<HomeCustomizationContent>
  published_content: Partial<HomeCustomizationContent>
  published_at: string | null
  created_at: string
  updated_at: string
}
