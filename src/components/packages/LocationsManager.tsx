import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import {
  FiArrowDown,
  FiArrowUp,
  FiEdit2,
  FiExternalLink,
  FiMapPin,
  FiPlus,
  FiSave,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import {
  createPackageLocation,
  deletePackageLocation,
  getPackageLocations,
  updatePackageLocation,
  updatePackageLocationsOrder,
} from '../../services/packageService'
import type { TourPackageLocation } from '../../types/tourPackage'

type LocationsManagerProps = {
  mapStyle?: string
  packageId: string
}

type LocationForm = {
  locationName: string
  latitude: string
  longitude: string
  dayOrder: string
  pinColor: string
}

type OsmSearchResult = {
  display_name: string
  lat: string
  lon: string
  name?: string
}

const UGANDA_BOUNDS = {
  maxLat: 4.4,
  maxLng: 35.2,
  minLat: -1.6,
  minLng: 29.3,
}

const emptyForm: LocationForm = {
  dayOrder: '',
  latitude: '',
  locationName: '',
  longitude: '',
  pinColor: '#007A24',
}

const inputClassName =
  'h-11 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200'

function getMapsSearchUrl(name: string) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(name)}`
}

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= UGANDA_BOUNDS.minLat && value <= UGANDA_BOUNDS.maxLat
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= UGANDA_BOUNDS.minLng && value <= UGANDA_BOUNDS.maxLng
}

function getLocationDayOrder(form: LocationForm, fallback: number) {
  return form.dayOrder.trim() ? Number(form.dayOrder) : fallback
}

function isValidHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function validateForm(form: LocationForm, locations: TourPackageLocation[], fallbackOrder: number, editingId?: string | null) {
  const locationName = form.locationName.trim()
  const latitude = Number(form.latitude)
  const longitude = Number(form.longitude)
  const dayOrder = getLocationDayOrder(form, fallbackOrder)

  if (!locationName) return 'Location name is required.'
  if (locations.some((location) => location.id !== editingId && location.location_name.trim().toLowerCase() === locationName.toLowerCase())) {
    return 'This package already has a location with that name.'
  }
  if (locations.some((location) => location.id !== editingId && location.day_order === dayOrder)) {
    return 'This package already has a location with that day order. Use the arrow controls to reorder saved stops.'
  }
  if (!isValidLatitude(latitude)) return 'Latitude must be within Uganda bounds.'
  if (!isValidLongitude(longitude)) return 'Longitude must be within Uganda bounds.'
  if (!Number.isInteger(dayOrder) || dayOrder < 1) return 'Day order must be a whole number greater than 0.'
  if (!isValidHexColor(form.pinColor)) return 'Pin color must be a valid hex color.'

  return ''
}

function mapLocationToForm(location: TourPackageLocation): LocationForm {
  return {
    dayOrder: String(location.day_order),
    latitude: String(location.latitude),
    locationName: location.location_name,
    longitude: String(location.longitude),
    pinColor: location.pin_color ?? '#007A24',
  }
}

function isFormPreviewable(form: LocationForm) {
  return (
    form.locationName.trim() &&
    isValidLatitude(Number(form.latitude)) &&
    isValidLongitude(Number(form.longitude))
  )
}

function createPreviewLocation(form: LocationForm, fallbackOrder: number): TourPackageLocation | null {
  if (!isFormPreviewable(form)) return null

  return {
    day_order: getLocationDayOrder(form, fallbackOrder),
    id: 'preview',
    latitude: Number(form.latitude),
    image_url: null,
    location_name: form.locationName.trim(),
    longitude: Number(form.longitude),
    notes: null,
    package_id: 'preview',
    pin_color: form.pinColor,
  }
}

function useOsmSearch(query: string) {
  const [results, setResults] = useState<OsmSearchResult[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    const searchText = query.trim()

    if (searchText.length < 3) {
      const clearTimer = window.setTimeout(() => { setResults([]); setStatus('idle') }, 0)
      return () => window.clearTimeout(clearTimer)
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setStatus('loading')

      try {
        const params = new URLSearchParams({
          addressdetails: '0',
          countrycodes: 'ug',
          format: 'jsonv2',
          limit: '5',
          q: searchText,
          viewbox: `${UGANDA_BOUNDS.minLng},${UGANDA_BOUNDS.maxLat},${UGANDA_BOUNDS.maxLng},${UGANDA_BOUNDS.minLat}`,
        })
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('OpenStreetMap search failed.')
        }

        const data = (await response.json()) as OsmSearchResult[]
        setResults(
          data.filter((result) => (
            isValidLatitude(Number(result.lat)) &&
            isValidLongitude(Number(result.lon))
          )),
        )
        setStatus('ready')
      } catch {
        if (controller.signal.aborted) return

        setResults([])
        setStatus('error')
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  return { results, status }
}

function createMarkerIcon(index: number, pinColor = '#007A24', isPreview = false) {
  return L.divIcon({
    className: '',
    html: `<span class="admin-route-pin ${isPreview ? 'admin-route-pin-preview' : ''}" style="--admin-pin-color: ${pinColor}; --admin-pin-glow: ${pinColor}33">${isPreview ? '+' : index + 1}</span>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28],
  })
}

function FitPreviewBounds({ locations }: { locations: TourPackageLocation[] }) {
  const map = useMap()

  useEffect(() => {
    if (locations.length === 0) return

    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 8)
      return
    }

    map.fitBounds(
      L.latLngBounds(locations.map((location) => [location.latitude, location.longitude])),
      { animate: true, padding: [26, 26] },
    )
  }, [locations, map])

  return null
}

function AnimatedPreviewRoute({ positions }: { positions: [number, number][] }) {
  const [routeRef, setRouteRef] = useState<L.Polyline | null>(null)

  useEffect(() => {
    const path = routeRef?.getElement() as SVGPathElement | null
    if (!path) return

    path.style.opacity = '0'
    path.getBoundingClientRect()
    path.style.transition = 'opacity 700ms cubic-bezier(0.22, 1, 0.36, 1)'
    path.style.opacity = '0.9'
  }, [positions, routeRef])

  if (positions.length < 2) return null

  return (
    <Polyline
      ref={setRouteRef}
      positions={positions}
      pathOptions={{ color: '#f08f4f', dashArray: '8 10', lineCap: 'round', lineJoin: 'round', opacity: 0.9, weight: 3 }}
    />
  )
}

const MAP_TILE_STYLES: Record<string, { className: string; url: string }> = {
  dark: {
    className: 'admin-map-tiles-dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
  },
  green: {
    className: 'admin-map-tiles-green',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  },
  light: {
    className: 'admin-map-tiles-light',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  },
  warm: {
    className: 'admin-map-tiles-warm',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  },
}

function RoutePreviewMap({ locations, mapStyle = 'light', previewLocation }: { locations: TourPackageLocation[]; mapStyle?: string; previewLocation: TourPackageLocation | null }) {
  const previewLocations = previewLocation ? [...locations, previewLocation] : locations
  const validLocations = previewLocations.filter((location) => isValidLatitude(location.latitude) && isValidLongitude(location.longitude))
  const routePositions = locations.map<[number, number]>((location) => [location.latitude, location.longitude])
  const center: [number, number] = validLocations.length > 0 ? [validLocations[0].latitude, validLocations[0].longitude] : [1.3733, 32.2903]
  const tileStyle = MAP_TILE_STYLES[mapStyle] ?? MAP_TILE_STYLES.light

  return (
    <div className="h-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-brand-50/40 shadow-sm">
      <MapContainer center={center} zoom={6} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer className={tileStyle.className} url={tileStyle.url} attribution="&copy; OpenStreetMap contributors &copy; CARTO" />
        <FitPreviewBounds locations={validLocations} />
        <AnimatedPreviewRoute positions={routePositions} />
        {locations.map((location, index) => (
          <Marker key={location.id} position={[location.latitude, location.longitude]} icon={createMarkerIcon(index, location.pin_color)} />
        ))}
        {previewLocation ? (
          <Marker position={[previewLocation.latitude, previewLocation.longitude]} icon={createMarkerIcon(0, previewLocation.pin_color, true)} />
        ) : null}
      </MapContainer>
    </div>
  )
}

function LocationsManager({ mapStyle = 'light', packageId }: LocationsManagerProps) {
  const [locations, setLocations] = useState<TourPackageLocation[]>([])
  const [newForm, setNewForm] = useState<LocationForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingForm, setEditingForm] = useState<LocationForm>(emptyForm)
  const [locationIdToDelete, setLocationIdToDelete] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReordering, setIsReordering] = useState(false)

  const sortedLocations = useMemo(
    () => [...locations].sort((first, second) => first.day_order - second.day_order),
    [locations],
  )
  const nextDayOrder = sortedLocations.length + 1
  const previewLocation = useMemo(() => createPreviewLocation(newForm, nextDayOrder), [newForm, nextDayOrder])
  const search = useOsmSearch(newForm.locationName)

  const loadLocations = useCallback(async () => {
    setError('')
    setIsLoading(true)

    try {
      const locationData = await getPackageLocations(packageId)
      setLocations(locationData)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      setError(message || 'Unable to load package locations. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [packageId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLocations(), 0)
    return () => window.clearTimeout(timer)
  }, [loadLocations])

  const selectSearchResult = async (result: OsmSearchResult) => {
    const label = result.name || result.display_name.split(',')[0] || result.display_name
    const selectedForm = {
      ...newForm,
      latitude: result.lat,
      locationName: label,
      longitude: result.lon,
    }

    setNewForm(selectedForm)
    setError('')
    setSuccessMessage('')

    const validationError = validateForm(selectedForm, locations, nextDayOrder)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsAdding(true)

    try {
      const dayOrder = getLocationDayOrder(selectedForm, nextDayOrder)

      const createdLocation = await createPackageLocation({
        day_order: dayOrder,
        image_url: null,
        latitude: Number(selectedForm.latitude),
        location_name: selectedForm.locationName.trim(),
        longitude: Number(selectedForm.longitude),
        notes: null,
        package_id: packageId,
        pin_color: selectedForm.pinColor,
      })

      setLocations((currentLocations) => [...currentLocations, createdLocation])
      setNewForm(emptyForm)
      setSuccessMessage('Location added from OpenStreetMap.')
    } catch (addError) {
      const message = addError instanceof Error ? addError.message : String(addError)
      setError(message || 'Unable to add location. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    const validationError = validateForm(newForm, locations, nextDayOrder)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsAdding(true)

    try {
      const dayOrder = getLocationDayOrder(newForm, nextDayOrder)

      const createdLocation = await createPackageLocation({
        day_order: dayOrder,
        latitude: Number(newForm.latitude),
        image_url: null,
        location_name: newForm.locationName.trim(),
        longitude: Number(newForm.longitude),
        notes: null,
        package_id: packageId,
        pin_color: newForm.pinColor,
      })

      setLocations((currentLocations) => [...currentLocations, createdLocation])
      setNewForm(emptyForm)
      setSuccessMessage('Location added.')
    } catch (addError) {
      const message = addError instanceof Error ? addError.message : String(addError)
      setError(message || 'Unable to add location. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const startEditing = (location: TourPackageLocation) => {
    setEditingId(location.id)
    setEditingForm(mapLocationToForm(location))
    setLocationIdToDelete(null)
    setError('')
    setSuccessMessage('')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingForm(emptyForm)
  }

  const saveEditing = async (locationId: string) => {
    const currentLocation = locations.find((location) => location.id === locationId)
    const fallbackOrder = currentLocation?.day_order ?? 1
    const validationError = validateForm(editingForm, locations, fallbackOrder, locationId)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSavingEdit(true)
    setError('')
    setSuccessMessage('')

    try {
      const dayOrder = getLocationDayOrder(editingForm, fallbackOrder)

      const updatedLocation = await updatePackageLocation(locationId, {
        day_order: dayOrder,
        latitude: Number(editingForm.latitude),
        image_url: null,
        location_name: editingForm.locationName.trim(),
        longitude: Number(editingForm.longitude),
        notes: null,
        pin_color: editingForm.pinColor,
      })

      setLocations((currentLocations) =>
        currentLocations.map((location) => location.id === locationId ? updatedLocation : location),
      )
      cancelEditing()
      setSuccessMessage('Location updated.')
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : String(updateError)
      setError(message || 'Unable to update location. Please try again.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const moveLocation = async (locationId: string, direction: -1 | 1) => {
    const currentIndex = sortedLocations.findIndex((location) => location.id === locationId)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedLocations.length) return

    const nextLocations = [...sortedLocations]
    const [movedLocation] = nextLocations.splice(currentIndex, 1)
    nextLocations.splice(nextIndex, 0, movedLocation)

    setIsReordering(true)
    setError('')
    setSuccessMessage('')

    try {
      const normalizedLocations = nextLocations.map((location, index) => ({
        ...location,
        day_order: index + 1,
      }))
      setLocations(normalizedLocations)
      await updatePackageLocationsOrder(normalizedLocations)
      setSuccessMessage('Route order updated.')
    } catch (reorderError) {
      const message = reorderError instanceof Error ? reorderError.message : String(reorderError)
      setError(message || 'Unable to reorder locations. Please try again.')
      void loadLocations()
    } finally {
      setIsReordering(false)
    }
  }

  const confirmDelete = async (locationId: string) => {
    setIsDeleting(true)
    setError('')
    setSuccessMessage('')

    try {
      await deletePackageLocation(locationId)
      setLocations((currentLocations) => currentLocations.filter((location) => location.id !== locationId))
      setLocationIdToDelete(null)
      setSuccessMessage('Location deleted.')
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : String(deleteError)
      setError(message || 'Unable to delete location. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-[90rem] overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:w-[92%] md:p-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-brand-200 bg-brand-50 text-admin-accent">
              <FiMapPin className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="break-words text-base font-semibold text-slate-950">Package Route Locations</h2>
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-admin-muted">
            Search OpenStreetMap, confirm the coordinates, and arrange the route shown on the public package page.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
          {sortedLocations.length} stop{sortedLocations.length === 1 ? '' : 's'}
        </div>
      </div>

      {search.status === 'error' ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          OpenStreetMap search could not load right now. Manual coordinates are available.
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {successMessage ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <form onSubmit={handleAddLocation} className="max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.55fr_0.55fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-800">Location Name <span className="text-red-600">*</span></span>
                <div className="relative">
                  <input
                    type="text"
                    value={newForm.locationName}
                    onChange={(event) => setNewForm((form) => ({ ...form, locationName: event.target.value }))}
                    className={inputClassName}
                    placeholder="Search Uganda destinations"
                    autoComplete="off"
                  />
                  {search.status === 'loading' ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-admin-muted shadow-lg">
                      Searching OpenStreetMap...
                    </div>
                  ) : null}
                  {search.results.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {search.results.map((result) => (
                        <button
                          key={`${result.lat}-${result.lon}-${result.display_name}`}
                          type="button"
                          onClick={() => void selectSearchResult(result)}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm leading-5 text-slate-700 transition hover:bg-brand-50 hover:text-slate-950"
                        >
                          {result.display_name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-800">Latitude <span className="text-red-600">*</span></span>
                <input type="number" step="any" value={newForm.latitude} onChange={(event) => setNewForm((form) => ({ ...form, latitude: event.target.value }))} className={inputClassName} placeholder="-1.052" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-800">Longitude <span className="text-red-600">*</span></span>
                <input type="number" step="any" value={newForm.longitude} onChange={(event) => setNewForm((form) => ({ ...form, longitude: event.target.value }))} className={inputClassName} placeholder="29.620" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-800">Day Order</span>
                <input type="number" min="1" step="1" value={newForm.dayOrder} onChange={(event) => setNewForm((form) => ({ ...form, dayOrder: event.target.value }))} className={inputClassName} placeholder={String(nextDayOrder)} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-800">Pin Color</span>
                <input type="color" value={newForm.pinColor} onChange={(event) => setNewForm((form) => ({ ...form, pinColor: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-300 bg-white p-1 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200" />
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <a href={newForm.locationName.trim() ? getMapsSearchUrl(newForm.locationName) : 'https://www.openstreetmap.org'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-admin-accent transition hover:text-brand-700">
                Open map search <FiExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <button type="submit" disabled={isAdding} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-admin-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70">
                <FiPlus className="h-4 w-4" aria-hidden="true" />
                {isAdding ? 'Adding...' : 'Add Location'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : sortedLocations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-800">No map locations added yet.</p>
                <p className="mt-1 break-words text-sm text-admin-muted">Add the first stop to show a route map on the public package page.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedLocations.map((location, index) => {
                  const isEditing = editingId === location.id
                  const isConfirmingDelete = locationIdToDelete === location.id

                  return (
                    <article key={location.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-admin-accent text-xs font-semibold text-white">{index + 1}</span>
                          {isEditing ? (
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.55fr_0.55fr]">
                                <input type="text" value={editingForm.locationName} onChange={(event) => setEditingForm((form) => ({ ...form, locationName: event.target.value }))} className={inputClassName} />
                                <input type="number" step="any" value={editingForm.latitude} onChange={(event) => setEditingForm((form) => ({ ...form, latitude: event.target.value }))} className={inputClassName} />
                                <input type="number" step="any" value={editingForm.longitude} onChange={(event) => setEditingForm((form) => ({ ...form, longitude: event.target.value }))} className={inputClassName} />
                                <input type="number" min="1" step="1" value={editingForm.dayOrder} onChange={(event) => setEditingForm((form) => ({ ...form, dayOrder: event.target.value }))} className={inputClassName} />
                                <input type="color" value={editingForm.pinColor} onChange={(event) => setEditingForm((form) => ({ ...form, pinColor: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-300 bg-white p-1 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200" aria-label="Pin color" />
                              </div>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-semibold leading-6 text-slate-900">{location.location_name}</p>
                              <p className="mt-1 break-words text-xs font-semibold text-admin-muted">
                                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} - Day {location.day_order}
                              </p>
                              <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-admin-muted">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: location.pin_color }} aria-hidden="true" />
                                {location.pin_color}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                          {isEditing ? (
                            <>
                              <button type="button" onClick={() => void saveEditing(location.id)} disabled={isSavingEdit} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-admin-accent px-3 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70">
                                <FiSave className="h-3.5 w-3.5" aria-hidden="true" />
                                {isSavingEdit ? 'Saving...' : 'Save'}
                              </button>
                              <button type="button" onClick={cancelEditing} disabled={isSavingEdit} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
                                <FiX className="h-3.5 w-3.5" aria-hidden="true" />
                                Cancel
                              </button>
                            </>
                          ) : isConfirmingDelete ? (
                            <>
                              <button type="button" onClick={() => void confirmDelete(location.id)} disabled={isDeleting} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70">
                                <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                              </button>
                              <button type="button" onClick={() => setLocationIdToDelete(null)} disabled={isDeleting} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => void moveLocation(location.id, -1)} disabled={index === 0 || isReordering} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-40" aria-label="Move location up" title="Move location up">
                                <FiArrowUp className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button type="button" onClick={() => void moveLocation(location.id, 1)} disabled={index === sortedLocations.length - 1 || isReordering} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-40" aria-label="Move location down" title="Move location down">
                                <FiArrowDown className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button type="button" onClick={() => startEditing(location)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent" aria-label="Edit location" title="Edit location">
                                <FiEdit2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button type="button" onClick={() => { setLocationIdToDelete(location.id); setEditingId(null); setError('') }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50" aria-label="Delete location" title="Delete location">
                                <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="min-w-0">
          <div className="sticky top-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-950">Live Map Preview</h3>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-admin-accent ring-1 ring-brand-200">
                {previewLocation ? sortedLocations.length + 1 : sortedLocations.length} stop{(previewLocation ? sortedLocations.length + 1 : sortedLocations.length) === 1 ? '' : 's'}
              </span>
            </div>
            <RoutePreviewMap locations={sortedLocations} mapStyle={mapStyle} previewLocation={previewLocation} />
          </div>
        </aside>
      </div>
    </section>
  )
}

export default LocationsManager
