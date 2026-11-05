import gorillaImage from '../assets/gorilla-7708328_1280.jpg'
import elephantImage from '../assets/elephant-4736008_1280.jpg'
import elephantBanner from '../assets/elephant.jpeg'
import balloon from '../assets/Ballon.jpeg'
import sunset from '../assets/elephants sunset.jpeg'

const images: Record<string, string> = {
  '/src/assets/gorilla-7708328_1280.jpg': gorillaImage,
  '/src/assets/gorilla-7708328_1920.jpg': gorillaImage,
  '/src/assets/elephant-4736008_1280.jpg': elephantImage,
  '/src/assets/elephant.jpeg': elephantBanner,
  '/src/assets/Ballon.jpeg': balloon,
  '/src/assets/elephants sunset.jpeg': sunset,
}

export function heroPreviewImage(url: string) {
  return images[url] || url
}
