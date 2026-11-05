import type { HomeCustomizationContent } from '../types/homeCustomization'
const localAssetUrls: Record<string,string> = {}
export const defaultHomeCustomization: HomeCustomizationContent = {
  "nav": {
    "logo": {
      "src": "/brand/caelum-logo-green.png",
      "alt": "Top Cloud Rwenzori Adventures"
    },
    "links": [
      {
        "id": "home",
        "label": "Home",
        "href": "/"
      },
      {
        "id": "tours",
        "label": "Tours",
        "href": "/tours"
      },
      {
        "id": "about",
        "label": "About",
        "href": "/about"
      }
    ],
    "inquiryButton": {
      "text": "Contact Us",
      "href": "/contact",
      "color": "#006b1f",
      "icon": "none"
    }
  },
  "hero": {
    "kicker": "Your safari story begins here",
    "title": "Explore Sites & Beauties of Africa",
    "subtitle": "Plan safaris, gorilla trekking, air ticketing, airport transfers, hotel reservations, car hire, and custom holidays with Top Cloud Rwenzori Adventures.",
    "cta": {
      "text": "Explore Tours",
      "href": "/tours",
      "color": "#006b1f",
      "icon": "arrow"
    },
    "background": {
      "src": "/brand/tree-lions.jpg",
      "alt": "Tree climbing lions"
    }
  },
  "story": {
    "label": "Your trip of a lifetime",
    "title": "Bespoke Experiences",
    "paragraphs": [
      "Intimate, extraordinary, and exclusive, every Top Cloud Rwenzori Adventures trip is unique. From iconic African safari destinations to air ticketing, airport transfers, hotel reservations, car hire, cultural experiences, and scenic escapes, we customise a journey that reflects your interests, timing, and dreams."
    ],
    "badges": [{"src": "/brand/Fav_icon.png", "alt": "Travel planning", "href": "/contact"}, {"src": "/brand/Fav_icon.png", "alt": "Safari tours", "href": "/tours"}, {"src": "/brand/Fav_icon.png", "alt": "Local support", "href": "https://wa.me/256766868460"}, {"src": "/brand/Fav_icon.png", "alt": "Top Cloud Rwenzori Adventures", "href": "/"}]
  },
  "signature": {
    "title": "Bespoke Safari Experiences",
    "description": "Choose the moments that matter most, then let Top Cloud Rwenzori Adventures shape the route, lodges, guiding, transport, and pace around you.",
    "image": {
      "src": "/brand/ele.jpg",
      "alt": "Safari tour"
    },
    "founderName": "",
    "founderRole": "",
    "items": [
      {
        "id": "0",
        "title": "Gorilla Trekking",
        "text": "",
        "icon": {
          "src": "/brand/gorilla-hero.jpg",
          "alt": "Gorilla Trekking"
        }
      },
      {
        "id": "1",
        "title": "Big Five Safaris",
        "text": "",
        "icon": {
          "src": "/brand/tree-lions.jpg",
          "alt": "Big Five Safaris"
        }
      },
      {
        "id": "2",
        "title": "Cultural Encounters",
        "text": "",
        "icon": {
          "src": "/brand/ele.jpg",
          "alt": "Cultural Encounters"
        }
      },
      {
        "id": "3",
        "title": "Honeymoon Safaris",
        "text": "",
        "icon": {
          "src": "/brand/elephants-sunset.jpeg",
          "alt": "Honeymoon Safaris"
        }
      },
      {
        "id": "4",
        "title": "Family Safaris",
        "text": "",
        "icon": {
          "src": "/brand/elephant.jpg",
          "alt": "Family Safaris"
        }
      },
      {
        "id": "5",
        "title": "Photography Trips",
        "text": "",
        "icon": {
          "src": "/brand/gorilla-forest.jpg",
          "alt": "Photography Trips"
        }
      }
    ]
  },
  "featuredTours": {
    "label": "Featured Safaris",
    "title": "Tour Packages",
    "description": "Explore handpicked journeys crafted by Top Cloud Rwenzori Adventures for wildlife lovers, families, couples, and adventure seekers."
  },
  "journey": {
    "label": "Ready to explore more?",
    "title": "Start Planning Your Safari",
    "description": "Speak with Top Cloud Rwenzori Adventures about your dates, flights, transfers, accommodation, group size, and dream wildlife moments.",
    "cta": {
      "text": "Get in touch",
      "href": "/contact",
      "color": "#006b1f",
      "icon": "arrow"
    },
    "image": {
      "src": "/brand/gorilla-hero.jpg",
      "alt": "Gorilla trekking safari"
    },
    "thumbnail": {
      "src": "/brand/ele.jpg",
      "alt": "Safari tour"
    }
  },
  "why": {
    "label": "What Drives Us",
    "title": "Our Initiatives",
    "description": "We are committed to responsible travel and creating positive impact for communities, wildlife and the environment across Uganda.",
    "cards": [
      {
        "id": "0",
        "title": "Responsible Tourism",
        "text": "Ethical travel that protects nature and uplifts local culture."
      },
      {
        "id": "1",
        "title": "Community Empowerment",
        "text": "Local partnerships that support skills and opportunity."
      },
      {
        "id": "2",
        "title": "Conservation Support",
        "text": "Protecting wildlife habitats through responsible safari planning."
      },
      {
        "id": "3",
        "title": "Eco-Friendly Travel",
        "text": "Lower-impact journeys shaped with thoughtful operations."
      }
    ]
  },
  "gallery": {
    "label": "Make Your Tour More Pleasure",
    "title": "Recent Gallery",
    "description": "",
    "images": [{"src": "/brand/ele.jpg", "alt": "Safari tour"}, {"src": "/brand/gorilla-hero.jpg", "alt": "Mountain gorilla"}, {"src": "/brand/tree-lions.jpg", "alt": "Wild lions"}, {"src": "/brand/elephant.jpg", "alt": "Elephants on safari"}, {"src": "/brand/tree-lions.jpg", "alt": "Tree climbing lions"}, {"src": "/brand/ele.jpg", "alt": "Guided safari tour"}, {"src": "/brand/elephant.jpg", "alt": "Wildlife safari"}]
  },
  "reviews": {
    "title": "What Our Clients Say",
    "description": "Read about our travelers? experiences."
  },
  "footerBand": {
    "src": "/brand/gorilla-hero.jpg",
    "alt": "Gorilla trekking safari"
  },
  "footer": {
    "about": "Air ticketing, safaris, tours, passport and visa services, hotels, travel insurance, and more. Explore the world with Top Cloud Rwenzori Adventures!",
    "phone": "+256 766 868 460",
    "email": "info@topcloudtours.com",
    "location": "Kakeeka Road, Rubaga B, Zaga Restaurant & Bar, opposite Montana Medical Chambers",
    "quickLinks": [
      {
        "id": "home",
        "label": "Home",
        "href": "/"
      },
      {
        "id": "tours",
        "label": "Tours",
        "href": "/tours"
      },
      {
        "id": "about",
        "label": "About",
        "href": "/about"
      },
      {
        "id": "contact",
        "label": "Contact",
        "href": "/contact"
      }
    ],
    "socials": [
      {
        "id": "whatsapp",
        "label": "WhatsApp",
        "href": "https://wa.me/256766868460"
      }
    ]
  },
  "sectionOrder": [
    "hero",
    "story",
    "services",
    "featuredTours",
    "gallery",
    "signature",
    "why",
    "journey",
    "reviews",
    "footerBand",
    "footer"
  ],
  "hiddenSections": []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function resolveLocalAssetReference(value: string) {
  return localAssetUrls[value] ?? value
}

function normalizeLocalAssetReferences<T>(value: T): T {
  if (typeof value === 'string') return resolveLocalAssetReference(value) as T
  if (Array.isArray(value)) return value.map((item) => normalizeLocalAssetReferences(item)) as T
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, normalizeLocalAssetReferences(entryValue)]),
    ) as T
  }

  return value
}

export function mergeHomeCustomization(
  content?: Partial<HomeCustomizationContent> | null,
  defaults: HomeCustomizationContent = defaultHomeCustomization,
): HomeCustomizationContent {
  if (!content) return defaults
  const normalizedContent = normalizeLocalAssetReferences(content)

  const merge = (base: unknown, override: unknown): unknown => {
    if (Array.isArray(base)) return Array.isArray(override) ? override : base
    if (isRecord(base)) {
      const next: Record<string, unknown> = { ...base }
      const overrideRecord = isRecord(override) ? override : {}
      Object.entries(base).forEach(([key, value]) => {
        next[key] = merge(value, overrideRecord[key])
      })
      Object.entries(overrideRecord).forEach(([key, value]) => {
        if (!(key in next)) next[key] = value
      })
      return next
    }
    return override === undefined || override === null ? base : override
  }

  return merge(defaults, normalizedContent) as HomeCustomizationContent
}
