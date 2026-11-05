import type { HomeCustomizationContent } from '../types/homeCustomization'
import type { HeroSliderContent } from '../types/heroSlider'
export function legacyHeroSlider(_hero: HomeCustomizationContent['hero']): HeroSliderContent {
 void _hero
 return {
  "autoplay": true,
  "duration_seconds": 5,
  "slides": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "image_url": "/brand/tree-lions.jpg",
      "pre_title": "Your safari story begins here",
      "title": "Explore Sites & Beauties of Africa",
      "subtitle": "Plan safaris, gorilla trekking, air ticketing, airport transfers, hotel reservations, car hire, and custom holidays with Top Cloud Rwenzori Adventures.",
      "button_text": "Explore Tours",
      "button_url": "/tours",
      "text_position": "center-left",
      "sort_order": 0,
      "is_active": true
    },
    {
      "id": "00000000-0000-4000-8000-000000000002",
      "image_url": "/brand/gorilla-hero.jpg",
      "pre_title": "Wild places, carefully planned",
      "title": "Gorilla Forest Encounters",
      "subtitle": "Travel into Uganda's misty forests with local experts, refined pacing, and unforgettable primate moments shaped around your style.",
      "button_text": "Explore Tours",
      "button_url": "/tours",
      "text_position": "center-left",
      "sort_order": 1,
      "is_active": true
    },
    {
      "id": "00000000-0000-4000-8000-000000000003",
      "image_url": "/brand/elephant.jpg",
      "pre_title": "Private journeys with purpose",
      "title": "Flights, Stays, Safaris",
      "subtitle": "Move from flight planning to ground transfers, lodging, tours, and travel consultancy with one attentive team.",
      "button_text": "Explore Tours",
      "button_url": "/tours",
      "text_position": "center-left",
      "sort_order": 2,
      "is_active": true
    }
  ]
}
}
